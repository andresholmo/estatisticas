# 🔧 Função SQL Atualizada: Suporte a Intervalo de Datas

## ❌ Problema

A função `get_quiz_stats` atual só suporta `date_limit` (filtra `>= date_limit`), mas não suporta `end_date` (filtra `<= end_date`). Isso significa que quando você seleciona um intervalo customizado (ex: "último dia"), ela retorna todos os dados desde a data de início até agora, não apenas o intervalo selecionado.

## ✅ Solução: Nova Função SQL com Start/End Dates

Crie uma nova função SQL que aceite `start_date` e `end_date` para filtrar corretamente os intervalos.

---

## 📝 Passo a Passo

### 1. Acesse o SQL Editor do Supabase

1. Vá em https://supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** no menu lateral
4. Clique em **"New Query"**

### 2. Cole e Execute este SQL:

```sql
-- Cria função que retorna estatísticas agregadas por quiz com intervalo de datas
CREATE OR REPLACE FUNCTION get_quiz_stats_v2(
  start_date timestamptz DEFAULT NULL,
  end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  quiz_id text,
  event text,
  count bigint
) AS $$
BEGIN
  IF start_date IS NULL AND end_date IS NULL THEN
    -- Sem filtro de data (todos os eventos)
    RETURN QUERY
    SELECT
      e.quiz_id,
      e.event,
      COUNT(*)::bigint as count
    FROM events e
    GROUP BY e.quiz_id, e.event
    ORDER BY e.quiz_id;
  ELSIF start_date IS NOT NULL AND end_date IS NOT NULL THEN
    -- Com intervalo de datas (start_date <= created_at <= end_date)
    RETURN QUERY
    SELECT
      e.quiz_id,
      e.event,
      COUNT(*)::bigint as count
    FROM events e
    WHERE e.created_at >= start_date AND e.created_at <= end_date
    GROUP BY e.quiz_id, e.event
    ORDER BY e.quiz_id;
  ELSIF start_date IS NOT NULL THEN
    -- Apenas start_date (>= start_date)
    RETURN QUERY
    SELECT
      e.quiz_id,
      e.event,
      COUNT(*)::bigint as count
    FROM events e
    WHERE e.created_at >= start_date
    GROUP BY e.quiz_id, e.event
    ORDER BY e.quiz_id;
  ELSE
    -- Apenas end_date (<= end_date)
    RETURN QUERY
    SELECT
      e.quiz_id,
      e.event,
      COUNT(*)::bigint as count
    FROM events e
    WHERE e.created_at <= end_date
    GROUP BY e.quiz_id, e.event
    ORDER BY e.quiz_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Concede permissões
GRANT EXECUTE ON FUNCTION get_quiz_stats_v2(timestamptz, timestamptz) TO anon, authenticated;
```

**Clique em RUN** (ou pressione Ctrl+Enter)

### 3. Teste a Função:

```sql
-- Testa sem filtros (todos os eventos)
SELECT * FROM get_quiz_stats_v2(NULL, NULL);

-- Testa com intervalo de 1 dia
SELECT * FROM get_quiz_stats_v2(
  NOW() - INTERVAL '1 day',
  NOW()
);

-- Testa com intervalo customizado
SELECT * FROM get_quiz_stats_v2(
  '2024-01-01 00:00:00+00'::timestamptz,
  '2024-01-02 23:59:59+00'::timestamptz
);
```

---

## 🔄 Atualizar API para Usar Nova Função

Após criar a função SQL, a API será atualizada automaticamente para usar `get_quiz_stats_v2` quando disponível, com fallback para `get_quiz_stats` se não existir.

---

## 📊 Vantagens

- ✅ Suporta intervalos de datas completos (start/end)
- ✅ Filtra corretamente quando você seleciona "último dia", "últimas 24h", etc.
- ✅ Mantém a eficiência (retorna apenas agregados, não eventos individuais)
- ✅ Compatível com a função antiga (usa date_limit como fallback)

---

## 🆘 Se Houver Erro

### Erro: "permission denied for function get_quiz_stats_v2"

**Solução:** Rode este SQL:
```sql
GRANT EXECUTE ON FUNCTION get_quiz_stats_v2(timestamptz, timestamptz) TO anon, authenticated;
```

### Erro: "function get_quiz_stats_v2 does not exist"

**Solução:** Verifique se criou a função corretamente. Rode:
```sql
SELECT proname FROM pg_proc WHERE proname = 'get_quiz_stats_v2';
```

Se não retornar nada, recrie a função.

---

**Desenvolvido com ❤️ para o Grupo UP Mídia**

