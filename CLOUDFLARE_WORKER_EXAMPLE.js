/**
 * Exemplo de Cloudflare Worker para Injeção do Script de Tracking v3.0
 *
 * Este arquivo mostra como implementar o script de tracking corrigido
 * em um Cloudflare Worker que intercepta e modifica o HTML dos quizzes.
 *
 * @version 3.0
 * @date 2024-10-31
 * @author Grupo UP Mídia
 */

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const TRACKING_API_URL = "https://estatisticas-six.vercel.app/api/track";

// ============================================================================
// WORKER PRINCIPAL
// ============================================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Processa a requisição e injeta o script de tracking
 */
async function handleRequest(request) {
  // Busca o conteúdo original
  const response = await fetch(request);

  // Se não for HTML, retorna sem modificações
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  // Extrai o quizId da URL
  const url = new URL(request.url);
  const quizId = url.searchParams.get('id');

  // Se não tiver quizId, retorna sem modificações
  if (!quizId) {
    return response;
  }

  // Lê o HTML original
  const originalHtml = await response.text();

  // Injeta o script de tracking
  const modifiedHtml = injectTrackingScript(originalHtml, quizId);

  // Retorna o HTML modificado
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

/**
 * Injeta o script de tracking no HTML
 *
 * @param {string} html - HTML original
 * @param {string} quizId - ID do quiz
 * @returns {string} HTML modificado com script injetado
 */
function injectTrackingScript(html, quizId) {
  // Script de tracking v3.0 (corrigido)
  const trackingScript = `
<script>
(function() {
  const quizId = "${quizId}";
  const API_URL = "${TRACKING_API_URL}";
  let completeSent = false;

  function sendEvent(event) {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: event, quizId: quizId })
    }).catch(() => {});
  }

  function setupTracking() {
    // 1. Envia VIEW automaticamente após 1 segundo
    setTimeout(() => sendEvent("view"), 1000);

    // 2. Adiciona listeners nos botões do quiz
    const buttons = document.querySelectorAll('.quiz-button');
    buttons.forEach((button) => {
      button.addEventListener('click', function() {
        if (!completeSent) {
          completeSent = true;
          sendEvent("complete");
        }
      });
    });

    // 3. Adiciona listener na imagem clicável (se existir)
    const imgLink = document.getElementById('imglink');
    if (imgLink) {
      imgLink.addEventListener('click', function() {
        if (!completeSent) {
          completeSent = true;
          sendEvent("complete");
        }
      });
    }
  }

  // 🚀 CORREÇÃO: Verifica se DOM já está pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTracking);
  } else {
    setupTracking(); // Executa imediatamente se DOM já estiver pronto
  }
})();
</script>`;

  // Injeta o script antes do </body>
  return html.replace('</body>', trackingScript + '\n</body>');
}

// ============================================================================
// EXEMPLO ALTERNATIVO: Worker com múltiplos seletores
// ============================================================================

/**
 * Versão alternativa com seletores personalizados
 * Use esta versão se seus botões tiverem classes diferentes
 */
function injectTrackingScriptCustomSelectors(html, quizId, config = {}) {
  const {
    buttonSelectors = '.quiz-button',
    imageLinkSelector = '#imglink',
    viewDelay = 1000
  } = config;

  const trackingScript = `
<script>
(function() {
  const quizId = "${quizId}";
  const API_URL = "${TRACKING_API_URL}";
  let completeSent = false;

  function sendEvent(event) {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: event, quizId: quizId })
    }).catch(() => {});
  }

  function setupTracking() {
    // 1. Envia VIEW automaticamente
    setTimeout(() => sendEvent("view"), ${viewDelay});

    // 2. Adiciona listeners nos botões (múltiplos seletores)
    const buttons = document.querySelectorAll('${buttonSelectors}');
    buttons.forEach((button) => {
      button.addEventListener('click', function() {
        if (!completeSent) {
          completeSent = true;
          sendEvent("complete");
        }
      });
    });

    // 3. Adiciona listener na imagem clicável
    const imgLink = document.querySelector('${imageLinkSelector}');
    if (imgLink) {
      imgLink.addEventListener('click', function() {
        if (!completeSent) {
          completeSent = true;
          sendEvent("complete");
        }
      });
    }
  }

  // 🚀 CORREÇÃO: Verifica se DOM já está pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTracking);
  } else {
    setupTracking();
  }
})();
</script>`;

  return html.replace('</body>', trackingScript + '\n</body>');
}

// ============================================================================
// EXEMPLO COM DEBUG/LOGS
// ============================================================================

/**
 * Versão com logs no console para debug
 * Útil durante desenvolvimento/testes
 */
function injectTrackingScriptWithDebug(html, quizId) {
  const trackingScript = `
<script>
(function() {
  const quizId = "${quizId}";
  const API_URL = "${TRACKING_API_URL}";
  const DEBUG = true; // Altere para false em produção
  let completeSent = false;

  function log(...args) {
    if (DEBUG) console.log('[Tracking]', ...args);
  }

  function sendEvent(event) {
    log('Enviando evento:', event, 'para quiz:', quizId);
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: event, quizId: quizId })
    })
    .then(r => r.json())
    .then(d => log('✅ Evento enviado:', d))
    .catch(e => log('❌ Erro ao enviar:', e));
  }

  function setupTracking() {
    log('Inicializando tracking para quiz:', quizId);

    // 1. Envia VIEW automaticamente
    setTimeout(() => {
      sendEvent("view");
      log('VIEW enviado automaticamente');
    }, 1000);

    // 2. Adiciona listeners nos botões
    const buttons = document.querySelectorAll('.quiz-button');
    log('Botões encontrados:', buttons.length);

    buttons.forEach((button, index) => {
      button.addEventListener('click', function() {
        log('Botão', index, 'clicado');
        if (!completeSent) {
          completeSent = true;
          sendEvent("complete");
        } else {
          log('COMPLETE já foi enviado, ignorando clique');
        }
      });
    });

    // 3. Adiciona listener na imagem clicável
    const imgLink = document.getElementById('imglink');
    if (imgLink) {
      log('Imagem clicável encontrada');
      imgLink.addEventListener('click', function() {
        log('Imagem clicada');
        if (!completeSent) {
          completeSent = true;
          sendEvent("complete");
        } else {
          log('COMPLETE já foi enviado, ignorando clique');
        }
      });
    } else {
      log('Imagem clicável não encontrada');
    }

    log('✅ Tracking inicializado com sucesso');
  }

  // 🚀 CORREÇÃO: Verifica se DOM já está pronto
  if (document.readyState === 'loading') {
    log('DOM ainda carregando, aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', setupTracking);
  } else {
    log('DOM já está pronto, executando imediatamente');
    setupTracking();
  }
})();
</script>`;

  return html.replace('</body>', trackingScript + '\n</body>');
}

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/**
 * Exemplo de como usar as diferentes versões
 */
async function exampleUsage(request) {
  const url = new URL(request.url);
  const quizId = url.searchParams.get('id');
  const response = await fetch(request);
  const html = await response.text();

  // OPÇÃO 1: Script básico (recomendado para produção)
  const option1 = injectTrackingScript(html, quizId);

  // OPÇÃO 2: Script com seletores personalizados
  const option2 = injectTrackingScriptCustomSelectors(html, quizId, {
    buttonSelectors: '.quiz-button, .btn-answer, #submit-quiz',
    imageLinkSelector: '#imglink, .quiz-image',
    viewDelay: 1500
  });

  // OPÇÃO 3: Script com debug (use apenas em desenvolvimento)
  const option3 = injectTrackingScriptWithDebug(html, quizId);

  // Retorne a versão desejada
  return new Response(option1, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// ============================================================================
// NOTAS DE IMPLEMENTAÇÃO
// ============================================================================

/**
 * IMPORTANTE:
 *
 * 1. Substitua TRACKING_API_URL pela URL correta do seu sistema
 *
 * 2. Ajuste os seletores CSS conforme sua estrutura HTML:
 *    - Botões: '.quiz-button' → ajuste se usar outra classe
 *    - Imagem: '#imglink' → ajuste se usar outro ID
 *
 * 3. Para múltiplos seletores, use vírgula:
 *    '.quiz-button, .btn-answer, #submit'
 *
 * 4. O script v3.0 resolve o problema de race condition:
 *    ✅ Funciona se injetado antes do DOM carregar
 *    ✅ Funciona se injetado depois do DOM carregar
 *
 * 5. Para testar, use a versão com debug e verifique o console
 *
 * 6. Em produção, use a versão básica (sem logs) para melhor performance
 *
 * 7. O script adiciona listeners apenas uma vez (não duplica eventos)
 *
 * 8. COMPLETE só é enviado uma vez, mesmo com múltiplos cliques
 */

// ============================================================================
// CHECKLIST DE DEPLOY
// ============================================================================

/**
 * Antes de fazer deploy:
 *
 * ✅ Verificar se TRACKING_API_URL está correto
 * ✅ Testar com um quiz de baixo tráfego primeiro
 * ✅ Verificar seletores CSS (.quiz-button, #imglink)
 * ✅ Remover/desabilitar logs de debug (se usou a versão com debug)
 * ✅ Testar em diferentes navegadores (Chrome, Firefox, Safari)
 * ✅ Verificar dashboard para confirmar recebimento dos eventos
 * ✅ Monitorar por 5-10 minutos antes de aplicar em todos os quizzes
 * ✅ Verificar taxa de conversão (deve estar entre 20-80% tipicamente)
 * ✅ Confirmar que VIEW e COMPLETE estão sendo enviados
 * ✅ Validar que não há erros no console do navegador
 */

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/**
 * Problema: VIEW não está sendo enviado
 * Solução:
 * - Verifique se o script está sendo injetado (view-source)
 * - Use a versão com debug para ver logs
 * - Confirme que a API está respondendo (teste manual)
 *
 * Problema: COMPLETE não está sendo enviado
 * Solução:
 * - Verifique se os seletores estão corretos
 * - Use document.querySelectorAll('.quiz-button') no console
 * - Confirme que os botões existem quando o script executa
 *
 * Problema: Eventos duplicados
 * Solução:
 * - Confirme que o script só é injetado uma vez
 * - Verifique se não há múltiplos workers processando a requisição
 *
 * Problema: Script não executa
 * Solução:
 * - Verifique se foi injetado antes do </body>
 * - Confirme que não há erros de sintaxe (valide o JavaScript)
 * - Teste a versão com debug para ver se há erros
 */
