# 🚀 EXECUTAR TUDO AGORA - RECONSTRUÇÃO COMPLETA

## 📋 RESUMO DO QUE FOI FEITO

### **Bugs Identificados e Corrigidos:**

1. ✅ **Eventos "view" sem deduplicação** - Corrigido no `worker.js`
2. ✅ **API sem rate limiting** - Adicionado em `/api/track`
3. ✅ **Dashboard com polling agressivo** - Reduzido de 15s → 60s
4. ✅ **Sem tracking de sessão** - Adicionado `session_id` em todos os eventos
5. ✅ **Banco sem índices otimizados** - Schema completo criado
6. ✅ **Funções SQL ineficientes** - Reescritas e otimizadas

---

## 🎯 PASSO A PASSO COMPLETO

### **PASSO 1: DELETAR E RECRIAR BANCO (5 minutos)**

Abra o **Supabase Dashboard → SQL Editor** e execute o arquivo:

**Arquivo:** `SCHEMA_COMPLETO_NOVO.sql`

Ou copie/cole todo o SQL dele. Ele faz:
- ✅ Deleta tabelas antigas e funções
- ✅ Cria tabelas: `users`, `sites`, `events`
- ✅ Cria 6 índices críticos (incluindo novos para deduplicação)
- ✅ Cria 5 funções SQL otimizadas
- ✅ Configura permissões

**Resultado esperado:** "Success" - Banco zerado e recriado do zero.

---

### **PASSO 2: VERIFICAR BANCO (1 minuto)**

No Supabase SQL Editor, execute:

```sql
-- Ver tabelas criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Ver índices criados
SELECT indexname FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;

-- Ver funções criadas
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**Você DEVE ver:**

**Tabelas:**
- events
- sites
- users

**Índices (6 no total):**
- idx_events_campaign
- idx_events_ip_hash ✅ NOVO
- idx_events_quiz_created
- idx_events_session ✅ NOVO
- idx_events_site_created
- idx_events_type_created

**Funções (5 no total):**
- cleanup_old_events ✅ NOVO
- get_quiz_campaigns
- get_quiz_stats_v3
- get_quiz_totals_v3
- upsert_site

---

### **PASSO 3: DEPLOY DO CÓDIGO (Automático)**

O código já foi corrigido nos seguintes arquivos:

**Frontend:**
- ✅ `pages/dashboard/index.js` - Polling 60s, refreshWhenHidden: false
- ✅ `pages/dashboard/campaigns/[quizId].js` - Polling 60s, refreshWhenHidden: false

**Backend:**
- ✅ `pages/api/track.js` - Rate limiting + deduplicação + session_id + ip_hash
- ✅ `worker.js` - Tracking script com sessionStorage e deduplicação

Quando você fizer commit e push, o **Vercel fará deploy automático** em ~2 minutos.

---

### **PASSO 4: TESTAR O SISTEMA (5 minutos)**

#### **Teste 1: Dashboard carrega?**

1. Acesse: `https://estatisticas-six.vercel.app/dashboard`
2. Faça login (se precisar reautenticar)
3. Dashboard deve carregar em < 2 segundos
4. Não haverá dados antigos (banco zerado)

**Resultado esperado:** ✅ Dashboard carrega sem erro 500

---

#### **Teste 2: Tracking funciona?**

1. Abra um quiz qualquer (ex: `https://seu-site.com/quiz/ddc`)
2. Verifique no console do navegador:
   - Deve aparecer request para `/api/track` com `event: "view"`
   - Response deve ser `{ ok: true, saved: "supabase" }`

3. Clique em um botão do quiz (complete)
4. Verifique no console:
   - Request para `/api/track` com `event: "complete"`
   - Response deve ser `{ ok: true, saved: "supabase" }`

5. **TESTE DE DEDUPLICAÇÃO:** Recarregue a página (F5)
6. Verifique no console:
   - Request deve retornar `{ saved: "duplicate-skipped" }`
   - Evento NÃO é salvo novamente (deduplicação funcionando!)

**Resultado esperado:** ✅ Eventos são rastreados e deduplicação funciona

---

#### **Teste 3: Ver eventos no banco**

No Supabase SQL Editor:

```sql
SELECT
  quiz_id,
  event,
  utm_campaign,
  session_id,
  ip_hash,
  created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
- ✅ Eventos aparecem com `session_id` preenchido
- ✅ Campo `ip_hash` preenchido (16 caracteres hexadecimais)
- ✅ Apenas 1 evento "view" por sessão (deduplicação funcionando)

---

#### **Teste 4: Dashboard mostra dados?**

1. Recarregue o dashboard: `https://estatisticas-six.vercel.app/dashboard`
2. Deve aparecer o quiz que você testou
3. Clique no `quiz_id`
4. Página de campanhas deve carregar
5. Deve mostrar a campanha UTM (ou "Sem campanha")

**Resultado esperado:** ✅ Dashboard e campanhas mostram dados corretos

---

#### **Teste 5: Rate limiting funciona?**

**Como testar:** Envie 11+ requests rapidamente do mesmo IP.

Execute no console do navegador (em qualquer página do quiz):

```javascript
for (let i = 0; i < 12; i++) {
  fetch('https://estatisticas-six.vercel.app/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'view',
      quizId: 'test-rate-limit',
      session_id: 's_test_' + i
    })
  }).then(r => r.json()).then(d => console.log(i, d));
}
```

**Resultado esperado:**
- Primeiras 10 requests: `{ ok: true, saved: "supabase" }`
- Request 11 e 12: `{ error: "Too many requests" }` (HTTP 429)

---

## ✅ CHECKLIST FINAL

Execute os passos **NA ORDEM**:

- [ ] **Passo 1:** Executei `SCHEMA_COMPLETO_NOVO.sql` no Supabase
- [ ] **Passo 2:** Verifiquei que tabelas, índices e funções foram criados
- [ ] **Passo 3:** Código foi feito deploy automaticamente pelo Vercel
- [ ] **Teste 1:** Dashboard carrega sem erro 500 ✅
- [ ] **Teste 2:** Tracking funciona e deduplicação está ativa ✅
- [ ] **Teste 3:** Eventos aparecem no banco com session_id e ip_hash ✅
- [ ] **Teste 4:** Dashboard mostra dados corretamente ✅
- [ ] **Teste 5:** Rate limiting bloqueia requests excessivos ✅

---

## 🎉 SE TUDO FUNCIONOU

**Parabéns! O sistema está 100% operacional e corrigido.**

### **O que mudou:**

**ANTES:**
- ❌ Cada refresh = novo evento "view"
- ❌ Sem rate limiting = possível abuse
- ❌ Polling agressivo (15s) sobrecarregava banco
- ❌ Milhões de eventos duplicados
- ❌ Timeouts constantes

**DEPOIS:**
- ✅ Deduplicação por sessão (1 evento "view" por quiz por sessão)
- ✅ Rate limiting (máximo 10 eventos/min por IP)
- ✅ Polling reduzido (60s) e apenas com aba ativa
- ✅ Banco otimizado com 6 índices
- ✅ Queries executam em < 1 segundo
- ✅ Tracking de sessão com `session_id`
- ✅ Privacy-friendly com `ip_hash` ao invés de IP completo

---

## 📊 MONITORAMENTO CONTÍNUO

### **Diário (Automático):**
Configure para rodar `SELECT * FROM cleanup_old_events();` todo dia às 3h AM.
Isso deleta eventos com mais de 30 dias automaticamente.

### **Semanal (Manual - 2 minutos):**
```sql
SELECT
  COUNT(*) as total_eventos,
  MIN(created_at) as evento_mais_antigo,
  MAX(created_at) as evento_mais_recente,
  pg_size_pretty(pg_total_relation_size('events')) as tamanho_tabela
FROM events;
```

**Objetivo:** Manter abaixo de 100 MB.

---

## 🆘 SE ALGO DER ERRADO

### **Erro: Dashboard ainda dá timeout**
- Verifique se os índices foram criados: veja Passo 2
- Verifique se as funções SQL foram criadas: veja Passo 2
- Verifique se está usando período "última 1 hora": veja código

### **Erro: Eventos não aparecem no banco**
- Verifique Vercel logs: pode ser erro de conexão com Supabase
- Verifique variáveis de ambiente no Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### **Erro: Tracking script não executa**
- Limpe cache do browser (Ctrl+Shift+Delete)
- Verifique se worker.js foi atualizado
- Abra console e procure por erros JavaScript

---

## 📞 SUPORTE TÉCNICO

Se precisar de ajuda, verifique os logs:

**Vercel Logs:**
- Vá em: `https://vercel.com/seu-projeto/logs`
- Procure por: `[Track]`, `[Dedup]`, `[RateLimit]`

**Supabase Logs:**
- Vá em: Supabase Dashboard → Logs → API
- Filtre por: `/rest/v1/events`

---

**Última atualização:** 18/11/2025
**Versão:** 4.0 - Reconstrução completa com correções de bugs
