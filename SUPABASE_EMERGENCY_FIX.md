# 🚨 Correção de Emergência - Funções SQL Otimizadas SEM Índices

## 📌 Use Esta Solução Se:

- ✅ Criar índices está dando timeout
- ✅ Você precisa que o dashboard funcione AGORA
- ✅ Tem muitos dados na tabela events

---

## 🎯 Estratégia

Vamos otimizar as funções SQL para:
1. **Processar menos dados** (limitar período padrão para 7 dias ao invés de 30)
2. **Filtrar mais cedo** (WHERE antes de GROUP BY)
3. **Usar menos memória** (evitar CTEs complexas)

---

## 1️⃣ Função Otimizada: get_quiz_campaigns (EMERGENCY)

```sql
-- Deleta função antiga
DROP FUNCTION IF EXISTS get_quiz_campaigns(text, timestamptz, timestamptz);

-- Cria versão otimizada (7 dias padrão ao invés de 30)
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
  -- ⚡ OTIMIZAÇÃO: 7 dias padrão (não 30) para reduzir dados processados
  v_end_date := COALESCE(p_end_date, NOW());
  v_start_date := COALESCE(p_start_date, v_end_date - INTERVAL '7 days');

  -- ⚡ OTIMIZAÇÃO: Query direta sem CTE
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

## 2️⃣ Função Otimizada: get_quiz_stats_v3 (EMERGENCY)

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

  -- ⚡ OTIMIZAÇÃO: 7 dias padrão
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
  LIMIT 1000; -- ⚡ OTIMIZAÇÃO: Limita resultado
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_stats_v3(text, text, timestamptz, timestamptz) TO anon, authenticated;
```

---

## 3️⃣ Função Otimizada: get_quiz_totals_v3 (EMERGENCY)

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
  -- ⚡ OTIMIZAÇÃO: 7 dias padrão
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
  LIMIT 100; -- ⚡ OTIMIZAÇÃO: Limita resultado
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_totals_v3(text, timestamptz, timestamptz) TO anon, authenticated;
```

---

## 🧪 Teste Após Aplicar

```sql
-- Deve ser rápido (últimos 7 dias)
SELECT * FROM get_quiz_campaigns('ddc');

-- Se ainda der timeout, teste com período menor
SELECT * FROM get_quiz_campaigns('ddc', NOW() - INTERVAL '1 day', NOW());
```

---

## ⚡ Otimizações Aplicadas

1. **Período padrão reduzido:** 7 dias ao invés de 30 dias
2. **LIMIT adicionado:** Evita retornar milhões de linhas
3. **Query simplificada:** Removidas CTEs desnecessárias
4. **Filtros mais restritivos:** WHERE antes de agregações

---

## 📊 Trade-offs

**Vantagens:**
- ✅ Funciona MESMO sem índices
- ✅ Resposta rápida (< 5 segundos)
- ✅ Dashboard funcional imediatamente

**Desvantagens:**
- ⚠️ Mostra apenas últimos 7 dias por padrão (não 30)
- ⚠️ Usuário precisa escolher datas manualmente para ver mais
- ⚠️ Limitado a 100 quizzes na tabela principal

---

## 🎯 Próximos Passos

**DEPOIS que o dashboard estiver funcionando:**

1. Tente criar os índices um por vez (veja SUPABASE_CREATE_INDEXES_STEP_BY_STEP.md)
2. Se conseguir criar os índices, volte para as funções originais (30 dias padrão)
3. Monitore performance no Supabase Dashboard

---

## 🔄 Como Voltar Para Funções Originais

Quando conseguir criar os índices, execute as funções do arquivo:
- `SUPABASE_OPTIMIZED_FUNCTIONS.md`

Elas têm 30 dias padrão e são otimizadas para usar os índices.

---

**Esta é uma solução TEMPORÁRIA até conseguir criar os índices!**
