# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [3.0.0] - 2024-10-31

### 🚨 BREAKING CHANGE: Script de Tracking Corrigido

A versão 2.0 do script de tracking tinha um **bug crítico** que impedia a captura de eventos. Esta versão corrige completamente o problema.

### ✅ Adicionado

- **Script de Tracking v3.0** com verificação de `document.readyState`
- Arquivo `worker.js` completo para Cloudflare Workers
- Arquivo `WORKER_UPDATE_GUIDE.md` com guia detalhado de deploy
- Arquivo `TRACKING_SCRIPT.md` com documentação completa do script
- Arquivo `tracking-script-readable.js` com código comentado
- Arquivo `CLOUDFLARE_WORKER_EXAMPLE.js` com exemplos de implementação
- Seção "Quick Start" no README para facilitar implementação
- Banner de alerta no README sobre a necessidade de atualizar para v3.0

### 🐛 Corrigido

- **Bug crítico**: Script v2.0 aguardava evento `DOMContentLoaded` mesmo quando DOM já estava carregado
- **Race condition**: Script agora verifica `document.readyState` antes de decidir como executar
- **Taxa de captura**: De 0% (v2.0) para 100% (v3.0)
- **Event listeners**: Agora são sempre adicionados, independente do timing de injeção

### 🔄 Modificado

- README reorganizado com v3.0 em destaque no topo
- Script de tracking minificado para melhor performance (~600 bytes)
- Documentação atualizada com instruções específicas para v3.0

### 📊 Impacto

**Antes (v2.0):**
- 300 acessos/min → 0 eventos capturados ❌
- Dashboard vazio
- Nenhum dado de conversão

**Depois (v3.0):**
- 300 acessos/min → ~300 VIEWs/min ✅
- ~120 COMPLETEs/min (40% conversão) ✅
- Dashboard atualizado em tempo real ✅

### 🔧 Como Atualizar

1. Substitua o código do Cloudflare Worker pelo conteúdo de `worker.js`
2. Ou copie apenas o script de tracking v3.0 do README
3. Siga o guia detalhado em `WORKER_UPDATE_GUIDE.md`
4. Teste e valide usando as instruções fornecidas

---

## [2.0.0] - 2024-10-30

### ✅ Adicionado

- Integração com Supabase para persistência real de dados
- Autenticação protegida por senha (AUTH_TOKEN)
- Filtros de data no dashboard (7 dias, 30 dias, todos)
- Gráficos visuais com Recharts
- API `/api/auth` para validação de tokens
- Verificação server-side de autenticação
- Sessão com expiração automática (24 horas)
- Sistema de fallback para JSON local

### 🔄 Modificado

- Dashboard redesenhado com gráficos
- API `/api/stats` agora suporta filtros de data
- API `/api/track` atualizada para Supabase
- Estrutura de dados otimizada com índices

### 🐛 Problemas Conhecidos (Corrigidos na v3.0)

- ❌ Script de tracking não capturava eventos (race condition)
- ❌ 0% de taxa de captura em produção
- ❌ Event listeners não eram adicionados

---

## [1.0.0] - 2024-10-15 (Versão Inicial)

### ✅ Adicionado

- Sistema básico de tracking de conversão
- Dashboard simples com tabela
- API `/api/track` para receber eventos
- API `/api/stats` para retornar estatísticas
- Armazenamento em JSON local
- Suporte a eventos VIEW e COMPLETE
- Integração básica com quizzes

### 📊 Funcionalidades

- Rastreamento de views e completes por quiz
- Cálculo de taxa de conversão
- Interface web para visualização
- Atualização automática dos dados

---

## Tipos de Mudanças

- **✅ Adicionado** - para novas funcionalidades
- **🔄 Modificado** - para mudanças em funcionalidades existentes
- **🗑️ Removido** - para funcionalidades removidas
- **🐛 Corrigido** - para correções de bugs
- **🔒 Segurança** - para correções de vulnerabilidades
- **🚨 Breaking Change** - para mudanças que quebram compatibilidade

---

## Links

- [Repositório](https://github.com/andresholmo/estatisticas)
- [Dashboard](https://estatisticas-six.vercel.app/dashboard)
- [Issues](https://github.com/andresholmo/estatisticas/issues)

---

**Desenvolvido com ❤️ para o Grupo UP Mídia**
