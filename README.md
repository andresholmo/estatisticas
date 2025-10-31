# 📈 Painel UP - Sistema de Rastreamento de Conversão de Quizzes

Sistema completo e leve de rastreamento de conversão de quizzes (pressells) hospedado na Vercel, com backend em API Routes (Next.js), armazenamento simples em JSON local, e um painel `/dashboard` com estatísticas em tempo real.

## 🚀 Deploy Rápido

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/seu-usuario/painelup)

## 💡 Contexto do Projeto

O sistema é usado em quizzes dinâmicos do Grupo UP Mídia. Cada quiz é acessado em URLs do tipo `nomedosite.com/qui-lp/?id=sigla`, com conteúdo dinâmico (título, imagem, perguntas, respostas e URL de redirecionamento).

Medimos a taxa de conversão por quiz — quantos usuários entram no quiz (**view**) e quantos clicam no botão final (**complete**).

## 🏗️ Arquitetura

```
/ (Next.js project)
│
├── /pages/api/
│   ├── track.js     → Recebe eventos "view" e "complete"
│   └── stats.js     → Retorna estatísticas agrupadas
│
├── /pages/
│   ├── index.js            → Página inicial (redireciona para dashboard)
│   └── dashboard/index.js  → Painel visual (React + Tailwind + SWR)
│
├── /data/events.json → Armazenamento local
│
├── /styles/globals.css → Estilos globais com Tailwind
│
└── /public/ → Assets estáticos
```

## 🧩 Endpoints da API

### 1. POST `/api/track`

Recebe eventos de view e complete dos quizzes.

**Payload:**
```json
{
  "event": "view",
  "quizId": "abc"
}
```

**Parâmetros:**
- `event`: `"view"` ou `"complete"`
- `quizId`: Identificador único do quiz (sigla)

**Resposta:**
```json
{
  "ok": true
}
```

### 2. GET `/api/stats`

Retorna estatísticas agrupadas por quiz.

**Resposta:**
```json
[
  {
    "quizId": "abc",
    "views": 120,
    "completes": 80,
    "conversionRate": "66.7%"
  }
]
```

## 📊 Painel Dashboard

Acessível em `/dashboard`, o painel exibe:

- ✅ Quiz ID
- ✅ Views
- ✅ Completes
- ✅ Taxa de conversão (%)
- ✅ Atualização automática a cada 5 segundos (SWR)
- ✅ Layout responsivo (desktop + mobile)
- ✅ Cores baseadas na taxa de conversão:
  - 🟢 Verde: ≥ 50%
  - 🟡 Amarelo: ≥ 25%
  - 🔴 Vermelho: < 25%

## 🔧 Instalação Local

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Passos

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/painelup.git
cd painelup

# Instale as dependências
npm install

# Execute em modo de desenvolvimento
npm run dev

# Acesse http://localhost:3000
```

## 📦 Deploy na Vercel

### Método 1: Via GitHub (Recomendado)

1. Faça push do código para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em "New Project"
4. Importe o repositório
5. Configure as variáveis de ambiente (opcional):
   - `AUTH_TOKEN`: Token de autenticação (se implementar)
6. Clique em "Deploy"

### Método 2: Via CLI

```bash
# Instale a CLI da Vercel
npm i -g vercel

# Deploy
vercel

# Deploy para produção
vercel --prod
```

## 🔒 Variáveis de Ambiente (Opcional)

Crie um arquivo `.env.local` para desenvolvimento:

```env
# Opcional: Token de autenticação para APIs
AUTH_TOKEN=minhasenha123

# Opcional: Configuração do Supabase (para migração futura)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR...
```

> **Nota:** O sistema funciona sem variáveis de ambiente. Elas são apenas para recursos opcionais futuros.

## 💻 Integração com Quizzes (Script Cloudflare)

Adicione este script no HTML do seu quiz hospedado no Cloudflare:

```html
<script>
  (() => {
    const quizId = new URLSearchParams(window.location.search).get('id');
    if (!quizId) return;

    // Função genérica para enviar evento de forma assíncrona
    const sendEvent = (event) => {
      fetch('https://painelup.vercel.app/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, quizId })
      }).catch(() => {});
    };

    // Envia "view" 1 segundo após o load (não bloqueia o carregamento)
    window.addEventListener('load', () => {
      setTimeout(() => sendEvent('view'), 1000);
    });

    // Observa o DOM e envia "complete" no clique do botão final
    const observer = new MutationObserver(() => {
      const btn = document.querySelector('.quiz-final-button');
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = true;
        btn.addEventListener('click', () => sendEvent('complete'));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
</script>
```

### Características do Script:

- ✅ Totalmente assíncrono
- ✅ Não bloqueia carregamento da página
- ✅ Impacto < 0.05s
- ✅ Observa o DOM para botões dinâmicos
- ✅ Envia "view" após 1 segundo do carregamento
- ✅ Envia "complete" no clique do botão final
- ✅ Tratamento de erros silencioso

### Personalização do Seletor

Se o botão final do quiz tiver uma classe diferente de `.quiz-final-button`, altere a linha:

```javascript
const btn = document.querySelector('.quiz-final-button');
```

Para o seletor correto, por exemplo:

```javascript
const btn = document.querySelector('#btnFinalizar');
// ou
const btn = document.querySelector('[data-action="complete"]');
```

## ⚡ Performance

- ✅ Nenhuma requisição bloqueante
- ✅ Fetch assíncrono sem await
- ✅ APIs leves e sem dependências externas
- ✅ Painel em tempo real (atualização a cada 5s)
- ✅ Impacto no carregamento do quiz < 0.05s

## 📈 Estrutura de Dados

Os eventos são armazenados em `data/events.json`:

```json
{
  "events": [
    {
      "event": "view",
      "quizId": "abc",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "ip": "192.168.1.1"
    },
    {
      "event": "complete",
      "quizId": "abc",
      "timestamp": "2024-01-15T10:32:30.000Z",
      "ip": "192.168.1.1"
    }
  ]
}
```

## 🔄 Migração para Supabase (Futuro)

O sistema está pronto para migrar de JSON local para Supabase quando necessário:

1. Crie um projeto no [Supabase](https://supabase.com)
2. Crie a tabela `events`:

```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  event VARCHAR(20) NOT NULL,
  quiz_id VARCHAR(50) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip VARCHAR(50)
);

CREATE INDEX idx_quiz_id ON events(quiz_id);
CREATE INDEX idx_event ON events(event);
```

3. Configure as variáveis de ambiente
4. Atualize os endpoints para usar o cliente Supabase

## 🧪 Testando Localmente

### 1. Testar API de Track

```bash
curl -X POST http://localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -d '{"event":"view","quizId":"teste"}'
```

### 2. Testar API de Stats

```bash
curl http://localhost:3000/api/stats
```

### 3. Visualizar Dashboard

Acesse: `http://localhost:3000/dashboard`

## 📝 Scripts do package.json

```bash
npm run dev    # Desenvolvimento (porta 3000)
npm run build  # Build de produção
npm run start  # Servidor de produção
npm run lint   # Verificar código
```

## 🛠️ Tecnologias Utilizadas

- **Next.js 14** - Framework React com API Routes
- **React 18** - Biblioteca JavaScript para UI
- **Tailwind CSS 3** - Framework CSS utilitário
- **SWR** - React Hooks para data fetching
- **Node.js** - Runtime JavaScript
- **Vercel** - Plataforma de deploy

## ✅ Critérios de Sucesso

- ✅ Painel `/dashboard` acessível e funcional
- ✅ Eventos gravados corretamente via `/api/track`
- ✅ Estatísticas corretas e atualizadas via `/api/stats`
- ✅ Nenhum impacto perceptível no quiz
- ✅ Projeto pronto para versionamento e escalabilidade
- ✅ Deploy automático na Vercel

## 📞 Suporte

Para dúvidas ou problemas:

1. Abra uma issue no GitHub
2. Entre em contato com a equipe de desenvolvimento do Grupo UP Mídia

## 📄 Licença

Propriedade do Grupo UP Mídia. Todos os direitos reservados.

---

**Desenvolvido com ❤️ para o Grupo UP Mídia**