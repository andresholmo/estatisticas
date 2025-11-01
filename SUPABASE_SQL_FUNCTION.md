# 🔧 Solução Definitiva: SQL Function no Supabase

## ❌ Problema

O Supabase JS client tem um limite **hardcoded** de ~1.000 linhas, mesmo usando `.limit(100000)` ou `.range()`. Com 45.451 eventos, é impossível buscar todos de uma vez.

## ✅ Solução: Agregação no Banco de Dados

Ao invés de buscar 45k linhas e processar no JS, fazemos a agregação direto no PostgreSQL.

---

## 📝 Passo a Passo

### 1. Acesse o SQL Editor do Supabase

1. Vá em https://supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** no menu lateral
4. Clique em **"New Query"**

### 2. Cole e Execute este SQL:

```sql
-- Cria função que retorna estatísticas agregadas por quiz
CREATE OR REPLACE FUNCTION get_quiz_stats(date_limit timestamptz DEFAULT NULL)
RETURNS TABLE (
  quiz_id text,
  event text,
  count bigint
) AS $$
BEGIN
  IF date_limit IS NULL THEN
    -- Sem filtro de data (todos os eventos)
    RETURN QUERY
    SELECT
      e.quiz_id,
      e.event,
      COUNT(*)::bigint as count
    FROM events e
    GROUP BY e.quiz_id, e.event
    ORDER BY e.quiz_id;
  ELSE
    -- Com filtro de data
    RETURN QUERY
    SELECT
      e.quiz_id,
      e.event,
      COUNT(*)::bigint as count
    FROM events e
    WHERE e.created_at >= date_limit
    GROUP BY e.quiz_id, e.event
    ORDER BY e.quiz_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Clique em RUN** (ou pressione Ctrl+Enter)

### 3. Teste a Função:

```sql
-- Testa a função (sem filtro de data)
SELECT * FROM get_quiz_stats(NULL);

-- Testa com filtro de 7 dias
SELECT * FROM get_quiz_stats(NOW() - INTERVAL '7 days');
```

Você DEVE ver algo como:
```
quiz_id | event    | count
--------|----------|-------
cbcn    | view     | 25000
cbcn    | complete | 11250
wlb     | view     | 3500
wlb     | complete | 980
...
```

---

## 📊 Vantagens

| Método | Linhas Transferidas | Processamento | Velocidade |
|--------|---------------------|---------------|------------|
| **Antes (JS)** | 45.451 linhas | JavaScript | ~3-5 segundos ❌ |
| **Depois (SQL)** | ~100 linhas (totais) | PostgreSQL | ~50ms ✅ |

---

## 🔧 Atualizar API (após criar a função)

Depois de criar a função SQL, atualize a API:

```javascript
// Em pages/api/stats.js

async function getStatsFromSupabase(range) {
  const dateLimit = getDateLimit(range);

  // Chama a função SQL que criamos
  const { data, error } = await supabase
    .rpc('get_quiz_stats', {
      date_limit: dateLimit
    });

  if (error) {
    console.error('Error calling get_quiz_stats:', error);
    throw error;
  }

  // Converte dados agregados para formato esperado
  return convertAggregatedData(data);
}

function convertAggregatedData(aggregated) {
  const events = [];

  aggregated.forEach(row => {
    const count = parseInt(row.count);
    // Cria "eventos fictícios" apenas para compatibilidade com calculateStats()
    for (let i = 0; i < count; i++) {
      events.push({
        quiz_id: row.quiz_id,
        event: row.event,
        created_at: new Date().toISOString()
      });
    }
  });

  return events;
}
```

---

## 🧪 Testar

Após criar a função SQL e fazer deploy:

```
https://estatisticas-six.vercel.app/api/stats?debug=true
```

Você DEVE ver:
```json
{
  "source": "supabase",
  "totalEvents": 45451,  ← TODOS os eventos!
  "supabaseConfigured": true,
  "stats": [...]
}
```

---

## 🚀 Performance

**Antes:**
- Busca: ~3-5 segundos
- Transferência: ~5MB de dados
- Limite: 1.000 eventos

**Depois:**
- Busca: ~50ms
- Transferência: ~5KB de dados
- Limite: Ilimitado (só retorna totais)

---

## 📝 Alternativa: Otimizar calculateStats()

Se não quiser criar a função SQL, podemos otimizar a função `calculateStats()` para ser mais eficiente e trabalhar direto com os dados agregados do Supabase.

Mas a função SQL é a solução **mais correta e escalável**.

---

## 🆘 Se Houver Erro

### Erro: "permission denied for function get_quiz_stats"

**Solução:** Rode este SQL:
```sql
GRANT EXECUTE ON FUNCTION get_quiz_stats(timestamptz) TO anon, authenticated;
```

### Erro: "function get_quiz_stats does not exist"

**Solução:** Verifique se criou a função corretamente. Rode:
```sql
SELECT proname FROM pg_proc WHERE proname = 'get_quiz_stats';
```

Se não retornar nada, recrie a função.

---

**Desenvolvido com ❤️ para o Grupo UP Mídia**
