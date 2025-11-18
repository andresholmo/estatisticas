# 🔥 FUNÇÕES SEM ANALYZE - EXECUTAR AGORA

## ⚠️ Se ANALYZE está dando timeout

**PULE o ANALYZE** e execute só as funções. O ANALYZE é opcional.

---

## 1️⃣ FUNÇÃO: get_quiz_campaigns

```sql
DROP FUNCTION IF EXISTS get_quiz_campaigns(text, timestamptz, timestamptz);

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
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '7 days');

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
```

---

## 2️⃣ FUNÇÃO: get_quiz_totals_v3

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
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '7 days');

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
```

---

## 3️⃣ FUNÇÃO: get_quiz_stats_v3

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
  v_trunc_format := CASE p_range
    WHEN 'hour' THEN 'hour'
    WHEN 'week' THEN 'week'
    ELSE 'day'
  END;

  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '7 days');

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

## ✅ Depois de executar as 3 funções

Teste o dashboard. Se ainda der timeout, significa que **faltam os índices**.

---

## 🔍 Verificar se índices existem

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

**Você DEVE ver:**
- `idx_events_campaign`
- `idx_events_quiz_created`
- `idx_events_site_created`
- `idx_events_type_created`

**Se NÃO aparecer nenhum desses**, os índices não foram criados e você precisa criá-los.

---

## 🚨 Se índices não existem - Criar um por vez

Execute cada índice **SEPARADAMENTE**:

### Índice 1 (MAIS IMPORTANTE):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_quiz_created
ON events(quiz_id, created_at DESC);
```

⏱️ Aguarde completar (pode demorar 5-10 minutos)

### Índice 2:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_campaign
ON events(quiz_id, utm_campaign, created_at DESC);
```

### Índice 3:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_site_created
ON events(site_id, created_at DESC);
```

### Índice 4:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type_created
ON events(event, created_at DESC);
```

---

## 📊 Quantos eventos você tem?

```sql
SELECT
  COUNT(*) as total_eventos,
  MIN(created_at) as primeiro_evento,
  MAX(created_at) as ultimo_evento,
  pg_size_pretty(pg_total_relation_size('events')) as tamanho_tabela
FROM events;
```

Isso vai te mostrar o volume de dados.

---

## 🎯 Resumo do que fazer AGORA

1. ✅ Execute as 3 funções acima (sem ANALYZE)
2. ✅ Verifique se índices existem
3. ❌ Se não existir, crie os índices um por vez
4. ✅ Teste o dashboard

Se as funções executarem com sucesso, o dashboard pode funcionar mesmo sem índices para dados de "hoje" (volume pequeno).

---

**Arquivo criado para você copiar e colar facilmente!**
