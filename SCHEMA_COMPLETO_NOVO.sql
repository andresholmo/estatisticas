-- ========================================
-- SCHEMA COMPLETO DO ZERO - COPY/PASTE PRONTO
-- ========================================
-- Execute tudo de uma vez no Supabase SQL Editor

-- ========================================
-- 1. DELETAR TUDO (SE EXISTIR)
-- ========================================

DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS get_quiz_campaigns(text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_stats_v3(text, text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_totals_v3(text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_events() CASCADE;
DROP FUNCTION IF EXISTS upsert_site(text, text, text, boolean) CASCADE;

-- ========================================
-- 2. CRIAR TABELAS
-- ========================================

-- Tabela: users (autenticação do dashboard)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: sites (domínios rastreados)
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: events (eventos de rastreamento)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('view', 'complete')),
  utm_campaign TEXT,
  session_id TEXT,  -- NOVO: Para deduplicação
  ip_hash TEXT,     -- NOVO: Para rate limiting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 3. CRIAR ÍNDICES (instantâneo em tabela vazia)
-- ========================================

-- Índices para users
CREATE INDEX idx_users_email ON users(email);

-- Índices para sites
CREATE INDEX idx_sites_domain ON sites(domain);
CREATE INDEX idx_sites_active ON sites(is_active) WHERE is_active = true;

-- Índices para events (CRÍTICOS PARA PERFORMANCE)
CREATE INDEX idx_events_quiz_created ON events(quiz_id, created_at DESC);
CREATE INDEX idx_events_campaign ON events(quiz_id, utm_campaign, created_at DESC);
CREATE INDEX idx_events_site_created ON events(site_id, created_at DESC);
CREATE INDEX idx_events_type_created ON events(event, created_at DESC);
CREATE INDEX idx_events_session ON events(session_id, quiz_id, event, created_at DESC);
CREATE INDEX idx_events_ip_hash ON events(ip_hash, created_at DESC);

-- ========================================
-- 4. DESABILITAR RLS (Row Level Security)
-- ========================================

ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 5. FUNÇÕES SQL
-- ========================================

-- Função: get_quiz_campaigns
CREATE OR REPLACE FUNCTION get_quiz_campaigns(
  p_quiz_id text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  campaign text,
  views bigint,
  completes bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  RETURN QUERY
  SELECT
    COALESCE(e.utm_campaign, 'Sem campanha')::text as campaign,
    COUNT(*) FILTER (WHERE e.event = 'view')::bigint as views,
    COUNT(*) FILTER (WHERE e.event = 'complete')::bigint as completes,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.event = 'view') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE e.event = 'complete')::numeric /
           COUNT(*) FILTER (WHERE e.event = 'view')::numeric) * 100,
          2
        )
      ELSE 0
    END::numeric as conversion_rate
  FROM events e
  WHERE
    e.quiz_id = p_quiz_id
    AND e.created_at >= v_start_date
    AND e.created_at <= v_end_date
  GROUP BY COALESCE(e.utm_campaign, 'Sem campanha')
  ORDER BY views DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_campaigns(text, timestamptz, timestamptz) TO anon, authenticated;

-- Função: get_quiz_totals_v3
CREATE OR REPLACE FUNCTION get_quiz_totals_v3(
  p_site_domain text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  site text,
  quiz_id text,
  views bigint,
  completes bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  RETURN QUERY
  SELECT
    COALESCE(s.domain, 'unknown')::text as site,
    e.quiz_id,
    COUNT(*) FILTER (WHERE e.event = 'view')::bigint as views,
    COUNT(*) FILTER (WHERE e.event = 'complete')::bigint as completes,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.event = 'view') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE e.event = 'complete')::numeric /
           COUNT(*) FILTER (WHERE e.event = 'view')::numeric) * 100,
          2
        )
      ELSE 0
    END::numeric as conversion_rate
  FROM events e
  LEFT JOIN sites s ON e.site_id = s.id
  WHERE
    e.created_at >= v_start_date
    AND e.created_at <= v_end_date
    AND (p_site_domain IS NULL OR s.domain = p_site_domain)
  GROUP BY
    s.domain,
    e.quiz_id
  ORDER BY
    views DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_totals_v3(text, timestamptz, timestamptz) TO anon, authenticated;

-- Função: get_quiz_stats_v3
CREATE OR REPLACE FUNCTION get_quiz_stats_v3(
  p_range text DEFAULT 'day',
  p_site_domain text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  bucket timestamptz,
  site text,
  quiz_id text,
  views bigint,
  completes bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_trunc_format text;
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  v_trunc_format := CASE p_range
    WHEN 'hour' THEN 'hour'
    WHEN 'week' THEN 'week'
    ELSE 'day'
  END;

  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  RETURN QUERY
  SELECT
    date_trunc(v_trunc_format, e.created_at) as bucket,
    COALESCE(s.domain, 'unknown')::text as site,
    e.quiz_id,
    COUNT(*) FILTER (WHERE e.event = 'view')::bigint as views,
    COUNT(*) FILTER (WHERE e.event = 'complete')::bigint as completes,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.event = 'view') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE e.event = 'complete')::numeric /
           COUNT(*) FILTER (WHERE e.event = 'view')::numeric) * 100,
          2
        )
      ELSE 0
    END::numeric as conversion_rate
  FROM events e
  LEFT JOIN sites s ON e.site_id = s.id
  WHERE
    e.created_at >= v_start_date
    AND e.created_at <= v_end_date
    AND (p_site_domain IS NULL OR s.domain = p_site_domain)
  GROUP BY
    date_trunc(v_trunc_format, e.created_at),
    s.domain,
    e.quiz_id
  ORDER BY
    bucket DESC,
    views DESC
  LIMIT 1000;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_stats_v3(text, text, timestamptz, timestamptz) TO anon, authenticated;

-- Função: cleanup_old_events (limpeza automática)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS TABLE (deleted_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count bigint;
BEGIN
  DELETE FROM events
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_events() TO service_role;

-- Função: upsert_site (usada pela API)
CREATE OR REPLACE FUNCTION upsert_site(
  p_domain text,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_id UUID;
BEGIN
  INSERT INTO sites (domain, name, description, is_active)
  VALUES (p_domain, p_name, p_description, p_is_active)
  ON CONFLICT (domain)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, sites.name),
    description = COALESCE(EXCLUDED.description, sites.description),
    is_active = EXCLUDED.is_active
  RETURNING id INTO v_site_id;

  RETURN v_site_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_site(text, text, text, boolean) TO anon, authenticated;

-- ========================================
-- 6. VERIFICAÇÃO FINAL
-- ========================================

-- Listar todas as tabelas
SELECT 'Tabelas criadas:' as info, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Listar todos os índices
SELECT 'Índices criados:' as info, indexname
FROM pg_indexes
WHERE tablename IN ('users', 'sites', 'events')
ORDER BY indexname;

-- Listar todas as funções
SELECT 'Funções criadas:' as info, routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ========================================
-- ✅ PRONTO! Banco reconstruído do zero
-- ========================================
