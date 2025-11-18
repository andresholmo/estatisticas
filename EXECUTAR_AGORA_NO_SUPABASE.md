# 🚨 EXECUTAR AGORA NO SUPABASE - RESOLVER TIMEOUT

## ⚠️ Problema Atual

Você está recebendo este erro no Vercel:

```
Error: code: '57014', message: 'canceling statement due to statement timeout'
```

**Causa:** As funções SQL no Supabase ainda não foram atualizadas para usar os índices e otimizações.

---

## ✅ Solução: Execute Este SQL no Supabase

**Abra o Supabase Dashboard → SQL Editor → Cole TODO este código → Clique em RUN:**

```sql
-- ========================================
-- PARTE 1: ANÁLISE DA TABELA
-- ========================================

ANALYZE events;

-- ========================================
-- PARTE 2: FUNÇÃO get_quiz_campaigns
-- ========================================

-- Deleta função antiga
DROP FUNCTION IF EXISTS get_quiz_campaigns(text, timestamptz, timestamptz);

-- Cria função otimizada
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
  -- Se não fornecido, usa últimos 7 dias
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

-- ========================================
-- PARTE 3: FUNÇÃO get_quiz_totals_v3
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
  -- Se não fornecido, usa últimos 7 dias
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

-- ========================================
-- PARTE 4: FUNÇÃO get_quiz_stats_v3
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

  -- Se não fornecido, usa últimos 7 dias
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

## 🧪 Teste Se Funcionou

Depois de executar o SQL acima, teste no Supabase SQL Editor:

```sql
-- Teste 1: Campanhas de hoje
SELECT * FROM get_quiz_campaigns(
  'ddc',
  CURRENT_DATE::timestamptz,
  NOW()
);

-- Teste 2: Totais de hoje
SELECT * FROM get_quiz_totals_v3(
  NULL,
  CURRENT_DATE::timestamptz,
  NOW()
);

-- Teste 3: Stats de hoje
SELECT * FROM get_quiz_stats_v3(
  'hour',
  NULL,
  CURRENT_DATE::timestamptz,
  NOW()
);
```

**Se retornar dados rapidamente (menos de 2 segundos), está funcionando!** ✅

---

## 🎯 O Que Isso Resolve?

**Antes:**
- ❌ Dashboard dando erro 500 (timeout)
- ❌ Página de campanhas dando erro 500 (timeout)
- ❌ Queries demorando 30+ segundos

**Depois:**
- ✅ Dashboard carrega em menos de 1 segundo
- ✅ Página de campanhas carrega em menos de 1 segundo
- ✅ Queries otimizadas usando índices existentes

---

## 📊 Como Funciona Agora?

1. **Frontend envia:** `startDate=2025-11-18T00:00:00Z&endDate=2025-11-18T18:45:00Z` (hoje)
2. **Funções SQL recebem** esses parâmetros
3. **PostgreSQL usa índices** para buscar apenas dados de hoje
4. **Resposta rápida:** < 1 segundo ⚡

---

## 🆘 Se Ainda Der Timeout Após Executar

Se mesmo após executar este SQL ainda der timeout, significa que você tem MUITO volume de dados mesmo de um único dia. Nesse caso:

### Opção 1: Verificar se índices existem

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

Você DEVE ver pelo menos:
- `idx_events_quiz_created`
- `idx_events_campaign`
- `idx_events_site_created`
- `idx_events_type_created`

Se não aparecer, execute o arquivo: `SUPABASE_CREATE_INDEXES_STEP_BY_STEP.md`

### Opção 2: Reduzir período ainda mais

No código, você pode mudar para mostrar apenas **últimas 6 horas** por padrão ao invés de "hoje":

```javascript
// Em pages/dashboard/index.js, linha 119-120:
const now = new Date();
const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 horas atrás
params.append('startDate', sixHoursAgo.toISOString());
params.append('endDate', now.toISOString());
```

---

## ✅ Checklist Final

- [ ] Executei o SQL completo no Supabase SQL Editor
- [ ] Vi "Success" na execução
- [ ] Testei as 3 queries de teste
- [ ] Elas retornaram dados rapidamente (< 2s)
- [ ] Atualizei o dashboard no navegador (Ctrl+F5)
- [ ] Dashboard carregou sem erro 500
- [ ] Cliquei em um Quiz ID
- [ ] Página de campanhas carregou sem erro 500

**Se todos os itens estão ✅, o problema está resolvido!** 🎉

---

## 📞 Verificação no Vercel Logs

Após aplicar, os logs do Vercel devem mostrar:

**Antes (erro):**
```
[Stats] Error calling get_quiz_stats_v3: code: '57014'
Error getting stats: message: 'canceling statement due to statement timeout'
```

**Depois (sucesso):**
```
[Stats] get_quiz_stats_v3 returned 24 bucketed rows
[Stats] get_quiz_totals_v3 returned 15 total rows
[Stats] Period: 2025-11-18T00:00:00Z to 2025-11-18T18:45:23Z
```

---

**Última atualização:** 18/11/2025 - Após commit 09ac96c
