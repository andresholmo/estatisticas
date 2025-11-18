# 🔨 RECONSTRUIR BANCO DO ZERO - GUIA COMPLETO

## 🚨 PROBLEMA IDENTIFICADO

Análise completa revelou **BUGS CRÍTICOS** que causaram explosão de dados:

### **Bug #1: Eventos "view" SEM deduplicação** 🔴
- Cada refresh da página = novo evento "view"
- Sem tracking de sessão (localStorage/sessionStorage)
- Mesma pessoa recarregando página = centenas de eventos

### **Bug #2: API sem rate limiting** 🔴
- `/api/track` aceita requests ilimitados
- Sem validação de duplicatas por IP/timestamp
- Bots ou scripts maliciosos podem inundar o banco

### **Bug #3: Dashboard com polling agressivo** 🟡
- Refresh a cada 15 segundos
- `refreshWhenHidden: true` (continua polling com aba fechada)
- Com milhões de eventos, cada poll causa timeout

---

## 📋 PLANO DE RECONSTRUÇÃO

### **FASE 1: DELETAR BANCO ATUAL**
### **FASE 2: CRIAR SCHEMA MÍNIMO**
### **FASE 3: CRIAR FUNÇÕES SQL OTIMIZADAS**
### **FASE 4: CONFIGURAR POLÍTICA DE RETENÇÃO (30 dias)**
### **FASE 5: CORRIGIR BUGS NO CÓDIGO**

---

# FASE 1: DELETAR BANCO ATUAL

## Opção A: Deletar apenas a tabela events (RECOMENDADO)

Isso mantém usuários e sites, deleta apenas eventos:

```sql
-- 1. Deletar todas as funções SQL
DROP FUNCTION IF EXISTS get_quiz_campaigns(text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_stats_v3(text, text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_totals_v3(text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_events() CASCADE;
DROP FUNCTION IF EXISTS upsert_site(text, text, text, boolean) CASCADE;

-- 2. Deletar a tabela events (e todos os índices junto)
DROP TABLE IF EXISTS events CASCADE;

-- 3. Tabelas users e sites ficam intactas (não precisa reautenticar)
```

**Resultado:** Tabela `events` deletada, mas autenticação e sites preservados.

---

## Opção B: Deletar TUDO (banco completo)

Use se quiser recomeçar absolutamente do zero:

```sql
-- ⚠️ ISSO DELETA TUDO - USUÁRIOS, SITES, EVENTOS
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Deletar todas as funções
DROP FUNCTION IF EXISTS get_quiz_campaigns(text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_stats_v3(text, text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_totals_v3(text, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_events() CASCADE;
DROP FUNCTION IF EXISTS upsert_site(text, text, text, boolean) CASCADE;
```

**Resultado:** Banco zerado. Você precisará reautenticar no dashboard.

---

## Opção C: Via Interface do Supabase

1. Vá em **Table Editor**
2. Clique em `events` → 3 pontinhos → **Delete table**
3. Repita para `sites` e `users` se quiser deletar tudo

---

# FASE 2: CRIAR SCHEMA MÍNIMO

Execute no Supabase SQL Editor:

```sql
-- ========================================
-- TABELA: users (autenticação)
-- ========================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para login rápido
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ========================================
-- TABELA: sites (domínios rastreados)
-- ========================================

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por domínio
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active) WHERE is_active = true;

-- ========================================
-- TABELA: events (dados de rastreamento)
-- ========================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('view', 'complete')),
  utm_campaign TEXT,
  session_id TEXT, -- ✅ NOVO: Para deduplicação
  ip_hash TEXT,    -- ✅ NOVO: Hash do IP para rate limiting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- ÍNDICES CRÍTICOS (criar COM DADOS depois)
-- ========================================
-- Nota: Como a tabela está vazia, criar índices agora é instantâneo
-- Se tivesse dados, usaríamos CREATE INDEX CONCURRENTLY

-- Índice #1: Busca por quiz e data (MAIS IMPORTANTE)
CREATE INDEX idx_events_quiz_created
ON events(quiz_id, created_at DESC);

-- Índice #2: Campanhas por quiz
CREATE INDEX idx_events_campaign
ON events(quiz_id, utm_campaign, created_at DESC);

-- Índice #3: Busca por site
CREATE INDEX idx_events_site_created
ON events(site_id, created_at DESC);

-- Índice #4: Busca por tipo de evento
CREATE INDEX idx_events_type_created
ON events(event, created_at DESC);

-- Índice #5: ✅ NOVO - Deduplicação por sessão
CREATE INDEX idx_events_session
ON events(session_id, quiz_id, event, created_at DESC);

-- Índice #6: ✅ NOVO - Rate limiting por IP
CREATE INDEX idx_events_ip_hash
ON events(ip_hash, created_at DESC);

-- ========================================
-- PERMISSÕES RLS (Row Level Security)
-- ========================================

-- Desabilita RLS nas tabelas públicas (API usa service key)
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Ou se preferir RLS, criar policies:
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon insert" ON events FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "Allow authenticated read" ON events FOR SELECT TO authenticated USING (true);
```

**Resultado:** Schema completo criado em ~1 segundo (tabela vazia).

---

# FASE 3: CRIAR FUNÇÕES SQL OTIMIZADAS

```sql
-- ========================================
-- FUNÇÃO 1: get_quiz_campaigns
-- ========================================

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
  -- Padrão: últimos 30 dias
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

-- ========================================
-- FUNÇÃO 2: get_quiz_totals_v3
-- ========================================

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

-- ========================================
-- FUNÇÃO 3: get_quiz_stats_v3
-- ========================================

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
```

---

# FASE 4: POLÍTICA DE RETENÇÃO (30 DIAS)

```sql
-- Função para limpar eventos antigos automaticamente
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS TABLE (deleted_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count bigint;
BEGIN
  -- Deleta eventos com mais de 30 dias
  DELETE FROM events
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_events() TO service_role;
```

**Configure para rodar diariamente:**
- Via pg_cron (se disponível no seu plano Supabase)
- Via Edge Function chamada por cron externo
- Manualmente toda semana

---

# FASE 5: TESTAR O BANCO

```sql
-- Teste 1: Verificar se tabelas existem
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Teste 2: Verificar índices criados
SELECT indexname
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;

-- Teste 3: Verificar funções criadas
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Teste 4: Inserir evento de teste
INSERT INTO events (site_id, quiz_id, event, utm_campaign)
VALUES (NULL, 'test', 'view', 'test-campaign')
RETURNING *;

-- Teste 5: Chamar função
SELECT * FROM get_quiz_campaigns('test', NOW() - INTERVAL '1 day', NOW());

-- Teste 6: Deletar teste
DELETE FROM events WHERE quiz_id = 'test';
```

---

## ✅ CHECKLIST DE EXECUÇÃO

Execute no Supabase SQL Editor, **NA ORDEM**:

- [ ] **Passo 1:** Deletar banco atual (Opção A ou B)
- [ ] **Passo 2:** Criar schema (tabelas + índices)
- [ ] **Passo 3:** Criar as 3 funções SQL
- [ ] **Passo 4:** Criar função de limpeza automática
- [ ] **Passo 5:** Executar os 6 testes acima
- [ ] **Passo 6:** Se tudo OK, deletar evento de teste

---

**Tempo total:** ~5 minutos

Depois disso, vou corrigir os bugs no código (worker.js e dashboard).
