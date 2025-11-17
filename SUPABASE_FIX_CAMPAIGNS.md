# 🔧 Correção da Função get_quiz_campaigns

## ❌ Problema Identificado

A função `get_quiz_campaigns` tem inconsistência entre o que declara retornar e o que efetivamente retorna:

- **Declara:** `utm_campaign text` no RETURNS TABLE
- **Retorna:** `cs.campaign` no SELECT

Isso causa erro 500 na API `/api/campaigns/[quizId]`

## ✅ Solução: Função Corrigida

Execute este SQL no Supabase SQL Editor para corrigir:

```sql
-- Função CORRIGIDA que retorna estatísticas por campanha de um quiz
CREATE OR REPLACE FUNCTION get_quiz_campaigns(
  p_quiz_id text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  campaign text,        -- ✅ CORRIGIDO: campaign (não utm_campaign)
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
    cs.campaign,  -- ✅ Consistente com RETURNS TABLE
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

-- Permissões
GRANT EXECUTE ON FUNCTION get_quiz_campaigns(text, timestamptz, timestamptz) TO anon, authenticated;
```

## 📝 Passo a Passo

1. **Acesse o Supabase Dashboard**
2. **Vá em SQL Editor**
3. **Cole o SQL acima**
4. **Clique em RUN**

## 🧪 Teste a Função

Depois de executar, teste com:

```sql
-- Testa se a função está retornando dados corretos
SELECT * FROM get_quiz_campaigns('ddc', NOW() - INTERVAL '30 days', NOW());
```

Você deve ver colunas:
- `campaign` (não `utm_campaign`)
- `views`
- `completes`
- `conversion_rate`

## 🔍 Principais Mudanças

1. **RETURNS TABLE:** `campaign text` (não `utm_campaign text`)
2. **Performance:** Usa `COUNT(*) FILTER` ao invés de `SUM(CASE WHEN)`
3. **Datas padrão:** Últimos 30 dias se não fornecidas
4. **STABLE:** Permite cache do query plan
5. **Consistência:** Nome da coluna bate com o que a API espera

## ✅ Como Saber se Funcionou

Depois de executar o SQL:

1. A API `/api/campaigns/ddc` deve retornar status 200 (não 500)
2. A página de campanhas deve carregar corretamente
3. Você verá a lista de campanhas com suas estatísticas
