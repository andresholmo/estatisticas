# 🔧 SQL Migration: Adicionar Suporte a Campanhas UTM

Execute este SQL no Supabase SQL Editor para adicionar suporte a campanhas UTM.

---

## 1️⃣ Adicionar Coluna utm_campaign na Tabela events

```sql
-- Adiciona coluna utm_campaign para armazenar o nome da campanha
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Cria índice para performance em queries filtradas por campanha
CREATE INDEX IF NOT EXISTS idx_events_utm_campaign ON events(utm_campaign);

-- Cria índice composto para queries filtradas por quiz e campanha
CREATE INDEX IF NOT EXISTS idx_events_quiz_campaign ON events(quiz_id, utm_campaign);
```

---

## 2️⃣ Função SQL: get_quiz_campaigns

Cria uma função que retorna estatísticas agregadas por campanha para um quiz específico:

```sql
-- Função que retorna estatísticas por campanha de um quiz
CREATE OR REPLACE FUNCTION get_quiz_campaigns(
  p_quiz_id text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  utm_campaign text,
  views bigint,
  completes bigint,
  conversion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH campaign_stats AS (
    SELECT
      COALESCE(e.utm_campaign, 'Sem campanha') as campaign,
      SUM(CASE WHEN e.event = 'view' THEN 1 ELSE 0 END)::bigint as views,
      SUM(CASE WHEN e.event = 'complete' THEN 1 ELSE 0 END)::bigint as completes
    FROM events e
    WHERE e.quiz_id = p_quiz_id
      AND (p_start_date IS NULL OR e.created_at >= p_start_date)
      AND (p_end_date IS NULL OR e.created_at <= p_end_date)
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
    END as conversion_rate
  FROM campaign_stats cs
  ORDER BY cs.views DESC;
END;
$$ LANGUAGE plpgsql;

-- Permissões
GRANT EXECUTE ON FUNCTION get_quiz_campaigns(text, timestamptz, timestamptz) TO anon, authenticated;
```

---

## 3️⃣ Teste a Função

```sql
-- Testa a função para um quiz específico
SELECT * FROM get_quiz_campaigns('ddc');

-- Testa com filtro de data (últimos 30 dias)
SELECT * FROM get_quiz_campaigns(
  'ddc',
  NOW() - INTERVAL '30 days',
  NOW()
);
```

Você DEVE ver algo como:
```
utm_campaign                    | views | completes | conversion_rate
--------------------------------|-------|-----------|----------------
SDM-04-SDM-WA193-171125-BR-DDC  | 1250  | 450       | 36.00
SDM-05-SDM-WA194-171126-BR-DDC  | 980   | 320       | 32.65
Sem campanha                    | 500   | 150       | 30.00
```

---

## 📊 Vantagens

- ✅ Agregação eficiente no banco de dados
- ✅ Suporta filtros de data opcionais
- ✅ Calcula taxa de conversão automaticamente
- ✅ Ordena por views (maior primeiro)
- ✅ Agrupa eventos sem campanha como "Sem campanha"

---

## 🆘 Se Houver Erro

### Erro: "permission denied for function get_quiz_campaigns"

**Solução:** Rode este SQL:
```sql
GRANT EXECUTE ON FUNCTION get_quiz_campaigns(text, timestamptz, timestamptz) TO anon, authenticated;
```

### Erro: "column utm_campaign does not exist"

**Solução:** Verifique se executou o passo 1 corretamente. Rode:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'utm_campaign';
```

Se não retornar nada, execute novamente o passo 1.

---

**Desenvolvido com ❤️ para o Grupo UP Mídia**

