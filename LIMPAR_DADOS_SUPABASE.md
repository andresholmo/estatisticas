# 🗑️ LIMPAR DADOS DO SUPABASE - EMERGÊNCIA

## ⚠️ SITUAÇÃO CRÍTICA

Volume de dados está tão grande que:
- ❌ Queries dão timeout
- ❌ ANALYZE dá timeout
- ❌ COUNT(*) dá timeout
- ❌ Até comandos simples não rodam
- 🚨 Provavelmente atingiu limites da conta Supabase

---

## 🎯 OPÇÕES DE LIMPEZA

Escolha UMA das opções abaixo baseado no que você precisa:

### **OPÇÃO 1: LIMPAR TUDO (RESET COMPLETO)** ⚠️

Use se você quer **começar do zero** e não precisa de dados antigos.

```sql
-- ⚠️ ISSO DELETA TODOS OS EVENTOS PERMANENTEMENTE
TRUNCATE TABLE events;
```

**Resultado:** Tabela zerada, todos os dados deletados instantaneamente.

---

### **OPÇÃO 2: MANTER ÚLTIMOS 7 DIAS** (RECOMENDADO) ✅

Use se você quer manter dados recentes e deletar o resto.

```sql
-- Deleta eventos com mais de 7 dias
DELETE FROM events
WHERE created_at < NOW() - INTERVAL '7 days';
```

**Atenção:** Pode demorar vários minutos se a tabela for muito grande.

---

### **OPÇÃO 3: MANTER ÚLTIMOS 30 DIAS**

Use se você quer manter 1 mês de histórico.

```sql
-- Deleta eventos com mais de 30 dias
DELETE FROM events
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

### **OPÇÃO 4: MANTER APENAS HOJE**

Use se você quer apenas dados de hoje.

```sql
-- Deleta tudo exceto hoje
DELETE FROM events
WHERE created_at < CURRENT_DATE;
```

---

## 🚨 SE O DELETE DER TIMEOUT

Se mesmo o DELETE der timeout, você precisa deletar em LOTES PEQUENOS:

### **Método 1: Deletar por data específica (um dia por vez)**

```sql
-- Exemplo: deletar apenas eventos de 1° de janeiro de 2025
DELETE FROM events
WHERE created_at >= '2025-01-01'
  AND created_at < '2025-01-02';
```

Execute isso várias vezes, mudando a data cada vez:
- `'2025-01-01'` e `'2025-01-02'`
- `'2025-01-02'` e `'2025-01-03'`
- `'2025-01-03'` e `'2025-01-04'`
- E assim por diante...

### **Método 2: Deletar em lotes de 10.000 registros**

```sql
-- Deleta 10 mil registros mais antigos
DELETE FROM events
WHERE id IN (
  SELECT id
  FROM events
  ORDER BY created_at ASC
  LIMIT 10000
);
```

Execute isso múltiplas vezes até limpar o suficiente.

---

## ✅ DEPOIS DE LIMPAR

Após deletar os dados, execute para otimizar a tabela:

```sql
-- Recupera espaço e atualiza estatísticas
VACUUM FULL events;
ANALYZE events;
```

**Atenção:** VACUUM FULL pode demorar muito tempo e BLOQUEIA a tabela. Execute apenas quando o sistema não estiver em produção.

---

## 📊 VERIFICAR TAMANHO ANTES E DEPOIS

### Antes de deletar:

```sql
SELECT
  COUNT(*) as total_eventos,
  MIN(created_at) as evento_mais_antigo,
  MAX(created_at) as evento_mais_recente,
  pg_size_pretty(pg_total_relation_size('events')) as tamanho_tabela
FROM events;
```

### Depois de deletar:

Execute o mesmo comando acima para ver a diferença.

---

## 🎯 MINHA RECOMENDAÇÃO

Se você não precisa de dados históricos antigos:

**1️⃣ Execute OPÇÃO 1 (TRUNCATE) para zerar tudo rapidamente**

```sql
TRUNCATE TABLE events;
```

**2️⃣ Em seguida, otimize:**

```sql
VACUUM FULL events;
ANALYZE events;
```

**3️⃣ Configure uma política de retenção de dados**

No futuro, configure para deletar automaticamente eventos antigos. Você pode criar uma função agendada no Supabase para rodar todo dia:

```sql
-- Função para limpar dados antigos automaticamente
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;
```

---

## 🆘 SE NADA FUNCIONAR

Se mesmo o TRUNCATE não funcionar, você tem duas opções:

### Opção A: Via Interface do Supabase
1. Vá no Supabase Dashboard
2. Table Editor → events
3. Clique nos 3 pontinhos → "Truncate table"

### Opção B: Recriar a tabela
1. Faça backup da estrutura da tabela
2. Delete a tabela inteira: `DROP TABLE events CASCADE;`
3. Recrie a tabela do zero (você tem o schema em `SUPABASE_SCHEMA_EVENTS.md`)

---

## ⚠️ IMPORTANTE

- ✅ TRUNCATE é INSTANTÂNEO (não dá timeout)
- ⚠️ DELETE pode dar timeout se muitos registros
- ⚠️ VACUUM FULL bloqueia a tabela durante execução
- 💾 Não há backup automático - dados deletados não podem ser recuperados

---

## 📞 VERIFICAR LIMITE DA CONTA

Depois de limpar, verifique no Supabase Dashboard:
- **Settings → Billing → Usage**
- Veja quanto de storage você estava usando
- Veja quantas requisições você faz por dia

Se você está no plano gratuito, o limite é:
- 500 MB de storage
- 2 GB de largura de banda
- 50.000 requisições/mês

---

**Execute agora e me diga qual opção você escolheu!**
