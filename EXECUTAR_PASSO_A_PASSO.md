# 🔥 EXECUTAR UM POR VEZ - EVITAR TIMEOUT

## ⚠️ O SQL completo dá timeout?

Execute cada comando **SEPARADAMENTE**, um de cada vez.

---

## 📝 PASSO 1: ANALYZE (Execute primeiro)

Cole só isso e execute:

```sql
ANALYZE events;
```

✅ Aguarde "Success" (deve ser rápido, alguns segundos)

---

## 📝 PASSO 2: get_quiz_campaigns

Cole só isso e execute:

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

✅ Aguarde "Success"

**Teste:**
```sql
SELECT * FROM get_quiz_campaigns('ddc', CURRENT_DATE::timestamptz, NOW());
```

---

## 📝 PASSO 3: get_quiz_totals_v3

Cole só isso e execute:

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

✅ Aguarde "Success"

**Teste:**
```sql
SELECT * FROM get_quiz_totals_v3(NULL, CURRENT_DATE::timestamptz, NOW());
```

---

## 📝 PASSO 4: get_quiz_stats_v3

Cole só isso e execute:

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

✅ Aguarde "Success"

**Teste:**
```sql
SELECT * FROM get_quiz_stats_v3('hour', NULL, CURRENT_DATE::timestamptz, NOW());
```

---

## ✅ Checklist

Execute na ordem:

- [ ] Passo 1: ANALYZE events
- [ ] Passo 2: get_quiz_campaigns
- [ ] Passo 3: get_quiz_totals_v3
- [ ] Passo 4: get_quiz_stats_v3

Depois de executar todos, teste o dashboard!

---

## 🎯 Se ainda der timeout mesmo separado

Isso significa que você tem MUITO volume de dados. Nesse caso, verifique se os **índices foram criados**:

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

**Você DEVE ver pelo menos:**
- `idx_events_campaign`
- `idx_events_quiz_created`
- `idx_events_site_created`
- `idx_events_type_created`

**Se NÃO aparecer**, significa que os índices não foram criados. Execute o arquivo `SUPABASE_CREATE_INDEXES_STEP_BY_STEP.md` para criar os índices primeiro.

---

**Última atualização:** 18/11/2025
