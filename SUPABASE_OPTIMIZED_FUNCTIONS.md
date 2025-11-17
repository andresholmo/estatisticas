# 🔧 Funções SQL Otimizadas - Corrigir Timeout

## ❌ Problema

As funções SQL `get_quiz_stats_v3`, `get_quiz_totals_v3` e `get_quiz_campaigns` estão dando timeout (código 57014) porque estão processando muitos dados sem índices adequados.

## ✅ Solução: Criar Índices e Otimizar Funções

### 1️⃣ Criar Índices para Performance

Execute este SQL primeiro para criar índices que aceleram as queries:

```sql
-- Índice composto para filtros de data e quiz_id
CREATE INDEX IF NOT EXISTS idx_events_quiz_created 
ON events(quiz_id, created_at DESC);

-- Índice para filtros de data e site
CREATE INDEX IF NOT EXISTS idx_events_site_created 
ON events(site_id, created_at DESC);

-- Índice para campanhas (quiz_id + utm_campaign + created_at)
CREATE INDEX IF NOT EXISTS idx_events_campaign 
ON events(quiz_id, utm_campaign, created_at DESC) 
WHERE utm_campaign IS NOT NULL;

-- Índice para eventos por tipo
CREATE INDEX IF NOT EXISTS idx_events_type_created 
ON events(event, created_at DESC);

-- Analisa tabela para otimizar estatísticas
ANALYZE events;
```

### 2️⃣ Função Otimizada: get_quiz_stats_v3

```sql
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
  -- Define formato de truncamento
  v_trunc_format := CASE p_range
    WHEN 'hour' THEN 'hour'
    WHEN 'week' THEN 'week'
    ELSE 'day'
  END;

  -- Define datas padrão se não fornecidas (últimos 30 dias)
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  -- Query otimizada com índices
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
    views DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_stats_v3(text, text, timestamptz, timestamptz) TO anon, authenticated;
```

### 3️⃣ Função Otimizada: get_quiz_totals_v3

```sql
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
  -- Define datas padrão se não fornecidas (últimos 30 dias)
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  -- Query otimizada - apenas totais, sem bucketing
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
    views DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_totals_v3(text, timestamptz, timestamptz) TO anon, authenticated;
```

### 4️⃣ Função Otimizada: get_quiz_campaigns

```sql
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
  -- Define datas padrão se não fornecidas
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '30 days');

  -- Query otimizada usando índice idx_events_campaign
  RETURN QUERY
  WITH campaign_stats AS (
    SELECT
      COALESCE(e.utm_campaign, 'Sem campanha') as campaign,
      COUNT(*) FILTER (WHERE e.event = 'view')::bigint as views,
      COUNT(*) FILTER (WHERE e.event = 'complete')::bigint as completes
    FROM events e
    WHERE 
      e.quiz_id = p_quiz_id
      AND e.created_at >= v_start_date
      AND e.created_at <= v_end_date
    GROUP BY COALESCE(e.utm_campaign, 'Sem campanha')
  )
  SELECT
    cs.campaign,
    cs.views,
    cs.completes,
    CASE
      WHEN cs.views > 0 THEN
        ROUND((cs.completes::numeric / cs.views::numeric) * 100, 2)
      ELSE 0
    END::numeric as conversion_rate
  FROM campaign_stats cs
  ORDER BY cs.views DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_campaigns(text, timestamptz, timestamptz) TO anon, authenticated;
```

## 📝 Passo a Passo

1. **Acesse o SQL Editor do Supabase**
2. **Execute o SQL do passo 1** (criar índices) - isso pode demorar alguns minutos se houver muitos dados
3. **Execute o SQL dos passos 2, 3 e 4** (criar/atualizar funções)
4. **Teste as funções:**

```sql
-- Testa get_quiz_stats_v3
SELECT * FROM get_quiz_stats_v3('day', NULL, NOW() - INTERVAL '7 days', NOW()) LIMIT 10;

-- Testa get_quiz_totals_v3
SELECT * FROM get_quiz_totals_v3(NULL, NOW() - INTERVAL '7 days', NOW()) LIMIT 10;

-- Testa get_quiz_campaigns
SELECT * FROM get_quiz_campaigns('ddc', NOW() - INTERVAL '7 days', NOW());
```

## ⚡ Melhorias

- **Índices compostos** para acelerar filtros por `quiz_id`, `created_at`, `site_id`
- **Índice parcial** para `utm_campaign` (apenas onde não é NULL)
- **Queries otimizadas** usando `FILTER` ao invés de `CASE WHEN` para agregações
- **Limite de datas padrão** (30 dias) se não fornecido
- **STABLE** nas funções para permitir cache de query plan

## 🆘 Se Ainda Der Timeout

Se ainda der timeout após criar os índices:

1. **Verifique se os índices foram criados:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'events';
```

2. **Force re-análise da tabela:**
```sql
ANALYZE events;
VACUUM ANALYZE events;
```

3. **Verifique estatísticas:**
```sql
SELECT 
  schemaname, 
  tablename, 
  n_live_tup, 
  n_dead_tup,
  last_vacuum,
  last_analyze
FROM pg_stat_user_tables 
WHERE tablename = 'events';
```

