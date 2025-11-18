# 📅 ESTRATÉGIA DE RETENÇÃO DE DADOS

## 🎯 OBJETIVO

Evitar que a tabela `events` cresça indefinidamente e cause timeouts/limites de conta.

---

## 📊 POLÍTICA RECOMENDADA

**Manter apenas os últimos 30 dias de dados**

Por quê?
- 30 dias é suficiente para análises recentes
- Mantém o banco leve e rápido
- Evita custos excessivos
- Queries executam em < 1 segundo

---

## 🤖 AUTOMAÇÃO: Limpeza Diária Automática

### Passo 1: Criar função de limpeza

Execute no Supabase SQL Editor:

```sql
-- Função que deleta eventos com mais de 30 dias
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS TABLE (deleted_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count bigint;
BEGIN
  -- Deleta eventos antigos
  DELETE FROM events
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Captura quantos foram deletados
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Retorna o resultado
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION cleanup_old_events() TO service_role;
```

### Passo 2: Agendar execução diária

No Supabase, você pode usar **pg_cron** (se disponível) ou criar um **Edge Function** que chama essa função diariamente.

#### Opção A: Via pg_cron (se disponível no seu plano)

```sql
-- Agendar para rodar todo dia às 3h da manhã
SELECT cron.schedule(
  'cleanup-old-events',
  '0 3 * * *',
  'SELECT cleanup_old_events();'
);
```

#### Opção B: Via Edge Function + Cron Job externo

1. Crie uma Edge Function no Supabase que chama `cleanup_old_events()`
2. Use um serviço externo (como cron-job.org) para chamar essa função todo dia

#### Opção C: Manual toda semana

Execute manualmente toda segunda-feira:

```sql
SELECT * FROM cleanup_old_events();
```

---

## 📈 MONITORAMENTO

Execute toda semana para monitorar o tamanho:

```sql
SELECT
  COUNT(*) as total_eventos,
  MIN(created_at) as evento_mais_antigo,
  MAX(created_at) as evento_mais_recente,
  pg_size_pretty(pg_total_relation_size('events')) as tamanho_tabela,
  pg_size_pretty(pg_total_relation_size('events') - pg_relation_size('events')) as tamanho_indices
FROM events;
```

**Objetivo:** Manter abaixo de 100 MB no total.

---

## 🔄 ROTINA DE MANUTENÇÃO

### **DIÁRIA** (Automatizada)
- ✅ Deletar eventos com mais de 30 dias

### **SEMANAL** (Manual - 5 minutos)
- ✅ Verificar tamanho da tabela
- ✅ Verificar evento mais antigo (deve ser ~30 dias atrás)

### **MENSAL** (Manual - 15 minutos)
- ✅ Verificar uso da conta no Supabase Dashboard
- ✅ Executar `VACUUM` para recuperar espaço
- ✅ Executar `ANALYZE` para atualizar estatísticas

```sql
-- Manutenção mensal
VACUUM events;
ANALYZE events;
```

---

## 📉 ALTERNATIVA: Particionamento por Data

Se você precisar manter mais histórico no futuro, considere **particionamento**:

```sql
-- Criar tabela particionada por mês
CREATE TABLE events_partitioned (
  LIKE events INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Criar partição para cada mês
CREATE TABLE events_2025_01 PARTITION OF events_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE events_2025_02 PARTITION OF events_partitioned
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- etc...
```

**Vantagens:**
- Deletar um mês inteiro é instantâneo (DROP PARTITION)
- Queries ficam mais rápidas (PostgreSQL só busca na partição relevante)

---

## 🎯 RESUMO EXECUTIVO

| Ação | Frequência | Responsável | Tempo |
|------|-----------|-------------|-------|
| Deletar eventos antigos | Diária (automático) | Função SQL | 0 min |
| Verificar tamanho | Semanal | Você | 2 min |
| VACUUM + ANALYZE | Mensal | Você | 15 min |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Executei a limpeza inicial (TRUNCATE ou DELETE antigos)
- [ ] Criei a função `cleanup_old_events()`
- [ ] Agendei a execução diária (cron ou manual)
- [ ] Configurei lembretes semanais para monitorar tamanho
- [ ] Documentei a política de retenção para o time

---

**Com isso, você nunca mais terá problema de volume de dados! 🎉**
