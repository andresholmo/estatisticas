# 🚀 GUIA COMPLETO: Supabase do Zero + Conexão Vercel

## 📋 PARTE 1: CRIAR BANCO DE DADOS NO SUPABASE

### **Passo 1.1: Criar o Schema (Tabelas + Índices + Funções)**

1. Acesse: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Faça login na sua conta nova
3. Clique em **"New Project"** (se ainda não criou)
   - Organization: Selecione sua organização
   - Name: `estatisticas` (ou o nome que preferir)
   - Database Password: **ANOTE ESSA SENHA** (você precisará dela)
   - Region: Escolha a mais próxima do Brasil (ex: South America - São Paulo)
   - Clique em **"Create new project"**
   - Aguarde 2-3 minutos enquanto provisiona

4. Quando o projeto estiver pronto, vá em **SQL Editor** (menu lateral esquerdo)

5. Clique em **"New Query"**

6. **COPIE TODO O CONTEÚDO** do arquivo `SCHEMA_COMPLETO_NOVO.sql` e cole no editor

7. Clique em **"RUN"** (ou pressione Ctrl+Enter)

8. **Resultado esperado:**
   - ✅ "Success. No rows returned"
   - Tempo: ~1-2 segundos

---

### **Passo 1.2: Verificar se tudo foi criado**

No mesmo SQL Editor, execute:

```sql
-- Ver tabelas criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Você DEVE ver:**
- events
- sites
- users

---

Execute:

```sql
-- Ver índices criados
SELECT indexname FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;
```

**Você DEVE ver 6 índices:**
- idx_events_campaign
- idx_events_ip_hash
- idx_events_quiz_created
- idx_events_session
- idx_events_site_created
- idx_events_type_created

---

Execute:

```sql
-- Ver funções criadas
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**Você DEVE ver 5 funções:**
- cleanup_old_events
- get_quiz_campaigns
- get_quiz_stats_v3
- get_quiz_totals_v3
- upsert_site

---

✅ **Se tudo acima está OK, banco criado com sucesso!**

---

## 📋 PARTE 2: PEGAR CREDENCIAIS DO SUPABASE

### **Passo 2.1: Encontrar as credenciais**

1. No Supabase Dashboard, clique em **Settings** (ícone de engrenagem no menu lateral)

2. Clique em **API** (no submenu)

3. Você verá 3 informações importantes:

---

#### **A) Project URL**
- Exemplo: `https://abcdefghijklm.supabase.co`
- **COPIE** esse URL completo

---

#### **B) Project API keys → anon/public**
- Seção: "Project API keys"
- Você verá: `anon` `public` (chave longa começando com `eyJ...`)
- Clique em **"Copy"** ao lado de `anon public`
- Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI...`

---

#### **C) Project API keys → service_role**
- **⚠️ ATENÇÃO:** Essa chave é SECRETA - nunca compartilhe ou commit no git!
- Role a página até "Project API keys"
- Você verá: `service_role` `secret` (chave longa começando com `eyJ...`)
- Clique em **"Reveal"** e depois **"Copy"**
- Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI...`

---

**📝 ANOTE AS 3 CREDENCIAIS:**

```
Project URL: https://abcdefghijklm.supabase.co
Anon Key: eyJhbGci...
Service Role Key: eyJhbGci...
```

---

## 📋 PARTE 3: CONECTAR NO VERCEL

### **Passo 3.1: Configurar variáveis de ambiente**

1. Acesse: [https://vercel.com/dashboard](https://vercel.com/dashboard)

2. Selecione o projeto **estatisticas** (ou como você nomeou)

3. Clique em **Settings** (aba superior)

4. No menu lateral esquerdo, clique em **Environment Variables**

5. **ADICIONE 3 VARIÁVEIS:**

---

#### **Variável 1: NEXT_PUBLIC_SUPABASE_URL**

- **Key:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** Cole o **Project URL** do Passo 2
  - Exemplo: `https://abcdefghijklm.supabase.co`
- **Environments:** Selecione TODOS (Production, Preview, Development)
- Clique em **"Add"**

---

#### **Variável 2: NEXT_PUBLIC_SUPABASE_ANON_KEY**

- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** Cole a **Anon Key** do Passo 2
  - Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Environments:** Selecione TODOS (Production, Preview, Development)
- Clique em **"Add"**

---

#### **Variável 3: SUPABASE_SERVICE_ROLE_KEY**

- **Key:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Cole a **Service Role Key** do Passo 2
  - Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Environments:** Selecione TODOS (Production, Preview, Development)
- Clique em **"Add"**

---

### **Passo 3.2: Forçar novo deploy**

Depois de adicionar as variáveis, você precisa fazer um novo deploy para que elas sejam aplicadas.

**Opção A: Via interface do Vercel**
1. Vá em **Deployments** (aba superior)
2. Clique nos 3 pontinhos do último deployment
3. Clique em **"Redeploy"**
4. Aguarde ~2 minutos

**Opção B: Via git push** (mais simples)
1. Faça qualquer alteração no código (pode ser só um espaço)
2. Commit e push
3. Vercel fará deploy automático

---

## 📋 PARTE 4: TESTAR A CONEXÃO

### **Teste 1: Verificar se variáveis foram aplicadas**

1. No Vercel, vá em **Settings → Environment Variables**
2. Verifique se as 3 variáveis estão listadas:
   - ✅ NEXT_PUBLIC_SUPABASE_URL
   - ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
   - ✅ SUPABASE_SERVICE_ROLE_KEY

---

### **Teste 2: Acessar o dashboard**

1. Acesse: `https://seu-projeto.vercel.app/dashboard`
2. Se pedir autenticação:
   - Você precisará criar um usuário no Supabase primeiro
   - Veja "EXTRA: Criar primeiro usuário" abaixo

---

### **Teste 3: Testar tracking de eventos**

1. Abra um quiz qualquer (se tiver)
2. Abra o DevTools do navegador (F12)
3. Vá na aba **Network**
4. Recarregue a página
5. Procure por request para `/api/track`
6. Clique no request e veja a **Response**

**Resultado esperado:**
```json
{
  "ok": true,
  "saved": "supabase",
  "event": "view",
  "quizId": "...",
  "site": "...",
  "siteId": "...",
  "timestamp": "..."
}
```

✅ Se `saved: "supabase"` = Conexão funcionando!

---

### **Teste 4: Verificar eventos no banco**

No Supabase SQL Editor:

```sql
SELECT
  quiz_id,
  event,
  session_id,
  ip_hash,
  created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
- Se testou um quiz, deve aparecer eventos aqui
- Com `session_id` e `ip_hash` preenchidos

---

## 🔐 EXTRA: CRIAR PRIMEIRO USUÁRIO (para acessar o dashboard)

Se você ainda não tem usuário para fazer login no dashboard:

### **Opção A: Via SQL (mais rápido)**

No Supabase SQL Editor, execute:

```sql
-- Substitua 'seu@email.com' e 'senha123' pelos seus dados
INSERT INTO users (email, password_hash)
VALUES (
  'seu@email.com',
  crypt('senha123', gen_salt('bf'))
);
```

**⚠️ Importante:** Você precisa ativar a extensão `pgcrypto` primeiro:

```sql
-- Execute isso ANTES do INSERT acima (só precisa uma vez)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

### **Opção B: Via API (usando o /api/register endpoint)**

Se o projeto tem endpoint de registro, use o formulário no frontend.

---

## ✅ CHECKLIST FINAL

Marque conforme for completando:

**SUPABASE:**
- [ ] Projeto criado no Supabase
- [ ] SQL executado com sucesso (SCHEMA_COMPLETO_NOVO.sql)
- [ ] Verificado: 3 tabelas criadas
- [ ] Verificado: 6 índices criados
- [ ] Verificado: 5 funções criadas
- [ ] Copiadas as 3 credenciais (URL + anon + service_role)

**VERCEL:**
- [ ] 3 variáveis de ambiente adicionadas
- [ ] Variáveis aplicadas em todos os ambientes (Production, Preview, Development)
- [ ] Novo deploy realizado

**TESTES:**
- [ ] Dashboard abre sem erro
- [ ] Tracking funciona (saved: "supabase")
- [ ] Eventos aparecem no banco
- [ ] Deduplicação funcionando (refresh não cria evento duplicado)

---

## 🆘 PROBLEMAS COMUNS

### **Erro: "Error connecting to Supabase"**
- Verifique se as variáveis de ambiente estão corretas
- Verifique se fez redeploy após adicionar variáveis
- Vá em Vercel → Deployments → clique no último → veja os logs

### **Erro: "Failed to load resource: 500"**
- Vá em Vercel → Deployments → Function Logs
- Procure por erros relacionados ao Supabase
- Verifique se a service_role key está correta

### **Dashboard pede login mas não tem usuário**
- Use o SQL acima para criar primeiro usuário
- Ou crie endpoint de registro

### **Eventos não aparecem no banco**
- Verifique se o worker.js no Cloudflare foi atualizado
- Verifique se `worker-cloudflare.js` está sendo usado
- Veja os logs do Vercel para erros

---

## 📞 PRÓXIMOS PASSOS

Depois que tudo estiver funcionando:

1. **Configurar limpeza automática** (deletar eventos com +30 dias)
2. **Monitorar uso do Supabase** (Settings → Usage)
3. **Atualizar Cloudflare Worker** com o arquivo `worker-cloudflare.js`
4. **Testar deduplicação** (F5 não deve criar evento duplicado)

---

**Criado em:** 18/11/2025
**Versão:** 1.0 - Setup inicial do zero
