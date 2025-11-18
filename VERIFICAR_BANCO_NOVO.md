# 🔍 VERIFICAR SE DADOS SÃO DO BANCO NOVO

Execute estes comandos SQL no **Supabase SQL Editor** para descobrir:

---

## ✅ TESTE 1: Verificar se campos novos existem

```sql
-- Verificar estrutura da tabela events
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
```

**Você DEVE ver estas colunas:**
- id
- site_id
- quiz_id
- event
- utm_campaign
- **session_id** ✅ (NOVO - se tem, é banco novo)
- **ip_hash** ✅ (NOVO - se tem, é banco novo)
- created_at

**Se FALTAR `session_id` ou `ip_hash` = banco antigo!**

---

## 🔎 TESTE 2: Ver eventos recentes e verificar campos

```sql
SELECT
  quiz_id,
  event,
  session_id,    -- ⬅️ Novo campo
  ip_hash,       -- ⬅️ Novo campo
  utm_campaign,
  created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;
```

**Se for banco NOVO:**
- ✅ `session_id` estará PREENCHIDO (ex: `s_1731937200000_abc123`)
- ✅ `ip_hash` estará PREENCHIDO (ex: `a1b2c3d4e5f6g7h8`)

**Se for banco ANTIGO:**
- ❌ `session_id` será NULL
- ❌ `ip_hash` será NULL

---

## 📅 TESTE 3: Ver quando foram criados os eventos

```sql
SELECT
  MIN(created_at) as primeiro_evento,
  MAX(created_at) as ultimo_evento,
  COUNT(*) as total_eventos
FROM events;
```

**Se criou o banco HOJE:**
- `primeiro_evento` deve ser de hoje (2025-11-18)
- Se for de dias/semanas atrás = banco antigo com dados antigos

---

## 🧪 TESTE 4: Verificar índices novos

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

**Banco NOVO deve ter 6 índices:**
- idx_events_campaign
- **idx_events_ip_hash** ✅ (NOVO)
- idx_events_quiz_created
- **idx_events_session** ✅ (NOVO)
- idx_events_site_created
- idx_events_type_created

**Se FALTAR os 2 índices destacados = banco antigo!**

---

## 🎯 TESTE 5: Verificar se tem duplicatas (banco antigo tem)

```sql
SELECT
  quiz_id,
  COUNT(*) as total_views,
  COUNT(DISTINCT session_id) as unique_sessions,
  CASE
    WHEN COUNT(DISTINCT session_id) > 0 THEN
      ROUND(COUNT(*)::numeric / COUNT(DISTINCT session_id)::numeric, 2)
    ELSE 0
  END as media_views_por_sessao
FROM events
WHERE event = 'view'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY quiz_id
ORDER BY total_views DESC;
```

**Se for banco NOVO com deduplicação:**
- `media_views_por_sessao` deve ser ~1.0 (1 view por sessão)

**Se for banco ANTIGO com bug:**
- `media_views_por_sessao` será > 2.0 (muitas views por sessão = duplicatas)

---

## 📊 RESUMO: COMO SABER

| Verificação | Banco NOVO ✅ | Banco ANTIGO ❌ |
|-------------|--------------|----------------|
| Campo `session_id` | Existe e preenchido | Não existe ou NULL |
| Campo `ip_hash` | Existe e preenchido | Não existe ou NULL |
| Índice `idx_events_session` | Existe | Não existe |
| Índice `idx_events_ip_hash` | Existe | Não existe |
| Data primeiro evento | Hoje (18/11) | Dias/semanas atrás |
| Views por sessão | ~1.0 | > 2.0 (muitas duplicatas) |

---

## 🚨 SE FOR BANCO ANTIGO

Você tem 2 opções:

### **Opção A: Zerar e começar do zero** (RECOMENDADO)
```sql
-- Deletar tudo
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE sites CASCADE;
TRUNCATE TABLE users CASCADE;

-- Executar SCHEMA_COMPLETO_NOVO.sql novamente
-- (copiar/colar todo o conteúdo do arquivo)
```

### **Opção B: Adicionar campos novos ao banco antigo**
```sql
-- Adicionar colunas novas
ALTER TABLE events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ip_hash TEXT;

-- Criar índices novos
CREATE INDEX IF NOT EXISTS idx_events_session
ON events(session_id, quiz_id, event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_ip_hash
ON events(ip_hash, created_at DESC);
```

⚠️ **Mas os dados antigos continuarão com session_id NULL!**

---

## ✅ SE FOR BANCO NOVO

Parabéns! Está tudo certo. Os dados que você vê são do banco novo com todas as correções.

Para confirmar que a deduplicação está funcionando:
1. Abra um quiz
2. Veja no console: request para `/api/track`
3. Aperte F5 (recarregar página)
4. Veja no console: deve retornar `saved: "duplicate-skipped"`

---

**Execute os testes acima e me diga o resultado!**
