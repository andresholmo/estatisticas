# 🔧 Criar Índices Passo a Passo (Para Tabelas Grandes)

## ⚠️ Problema

Ao executar todos os índices de uma vez, o Supabase dá timeout:
```
Error: SQL query ran into an upstream timeout
```

Isso acontece porque a tabela `events` tem muitos dados e criar índices demora.

---

## ✅ Solução: Criar Índices Um Por Vez

Execute cada SQL **separadamente**, aguardando cada um completar antes do próximo.

---

### 1️⃣ Índice Principal (quiz_id + created_at)

**Este é o mais importante - execute primeiro:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_quiz_created
ON events(quiz_id, created_at DESC);
```

✅ Aguarde até aparecer "Success" (pode demorar 2-5 minutos)

**Por que este é importante?**
- Usado em `get_quiz_stats_v3`
- Usado em `get_quiz_totals_v3`
- Usado em `get_quiz_campaigns`

---

### 2️⃣ Índice de Campanhas (quiz_id + utm_campaign + created_at)

**Execute após o primeiro terminar:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_campaign
ON events(quiz_id, utm_campaign, created_at DESC);
```

✅ Aguarde completar

**Por que este é importante?**
- Usado especificamente em `get_quiz_campaigns`
- Acelera filtros por campanha UTM

---

### 3️⃣ Índice de Sites (site_id + created_at)

**Execute após o segundo terminar:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_site_created
ON events(site_id, created_at DESC);
```

✅ Aguarde completar

**Por que este é importante?**
- Usado quando filtra por site no dashboard
- Acelera queries multi-site

---

### 4️⃣ Índice de Tipo de Evento (event + created_at)

**Execute após o terceiro terminar:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type_created
ON events(event, created_at DESC);
```

✅ Aguarde completar

**Por que este é importante?**
- Acelera contagem de views vs completes
- Melhora performance geral

---

### 5️⃣ Analisa a Tabela

**Por último, execute:**

```sql
ANALYZE events;
```

✅ Este é rápido (alguns segundos)

**O que faz?**
- Atualiza estatísticas da tabela
- Permite PostgreSQL escolher melhor plano de query

---

## 🔍 Verificar Índices Criados

Depois de criar todos, verifique:

```sql
SELECT
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

Você deve ver:
- `idx_events_quiz_created`
- `idx_events_campaign`
- `idx_events_site_created`
- `idx_events_type_created`

---

## 🧪 Testar Performance

Depois de criar os índices, teste a função:

```sql
-- Deve ser RÁPIDO (menos de 1 segundo)
EXPLAIN ANALYZE
SELECT * FROM get_quiz_campaigns('ddc', NOW() - INTERVAL '7 days', NOW());
```

Na saída, procure por:
- `Index Scan using idx_events_campaign` ✅ BOM
- `Seq Scan on events` ❌ RUIM (significa que não usou índice)

---

## ⚡ Vantagens do CONCURRENTLY

`CREATE INDEX CONCURRENTLY`:
- ✅ Não bloqueia a tabela
- ✅ Aplicação continua funcionando durante criação
- ✅ Mais lento mas mais seguro

Sem `CONCURRENTLY`:
- ❌ Bloqueia tabela durante criação
- ❌ Queries podem falhar
- ✅ Mais rápido

**Recomendação:** Use sempre `CONCURRENTLY` em produção!

---

## 🆘 Se Ainda Der Timeout

Se mesmo criando um por vez ainda der timeout, você tem 3 opções:

### Opção 1: Aumentar Statement Timeout (Temporário)

```sql
-- Aumenta timeout para 10 minutos
SET statement_timeout = '600000'; -- 10 minutos em ms

-- Depois cria o índice
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_quiz_created
ON events(quiz_id, created_at DESC);

-- Volta ao normal
RESET statement_timeout;
```

### Opção 2: Conectar Direto via psql

Use a connection string do Supabase:
```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

No psql, você tem controle total sobre timeouts.

### Opção 3: Criar Índices Parciais (Menor)

Cria índices apenas para dados recentes:

```sql
-- Índice apenas para últimos 90 dias
CREATE INDEX CONCURRENTLY idx_events_quiz_created_90d
ON events(quiz_id, created_at DESC)
WHERE created_at >= NOW() - INTERVAL '90 days';
```

---

## 📊 Quanto Tempo Demora?

**Estimativa (depende do volume de dados):**

| Linhas na Tabela | Tempo por Índice |
|------------------|------------------|
| 100k eventos     | 10-30 segundos   |
| 1M eventos       | 1-3 minutos      |
| 10M eventos      | 5-15 minutos     |
| 100M eventos     | 30-60 minutos    |

**Verificar quantas linhas você tem:**

```sql
SELECT
  COUNT(*) as total_events,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event,
  pg_size_pretty(pg_total_relation_size('events')) as table_size
FROM events;
```

---

**Desenvolvido com ❤️ para o Grupo UP Mídia**
