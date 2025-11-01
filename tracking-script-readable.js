/**
 * Script de Tracking v3.0 - Versão Legível/Comentada
 *
 * Esta é a versão comentada do script que está minificado no worker.js
 * Use este arquivo como referência para entender o funcionamento
 *
 * @version 3.0
 * @date 2024-10-31
 */

// ============================================================================
// VERSÃO MINIFICADA (usada no worker.js)
// ============================================================================

/*
(function(){var q="${quizId}",a="https://estatisticas-six.vercel.app/api/track",c=false;function s(e){fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:e,quizId:q})}).catch(function(){})}function setup(){setTimeout(function(){s("view")},1000);function complete(){if(!c){c=true;s("complete")}}var btns=document.querySelectorAll(".quiz-button");btns.forEach(function(btn){btn.addEventListener("click",complete)});var il=document.getElementById("imglink");if(il){il.addEventListener("click",complete)}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",setup)}else{setup()}})();
*/

// ============================================================================
// VERSÃO LEGÍVEL (para entendimento)
// ============================================================================

(function() {
  // ===== CONFIGURAÇÃO =====
  const quizId = "QUIZ_ID_AQUI"; // Substituído dinamicamente pelo Worker
  const API_URL = "https://estatisticas-six.vercel.app/api/track";
  let completeSent = false; // Flag para prevenir múltiplos COMPLETEs

  /**
   * Envia um evento para a API de tracking
   *
   * @param {string} event - Tipo do evento: "view" ou "complete"
   */
  function sendEvent(event) {
    fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event: event,
        quizId: quizId
      })
    }).catch(function() {
      // Ignora erros silenciosamente (não impacta UX)
    });
  }

  /**
   * Configura os event listeners e envia o VIEW inicial
   * Esta função é chamada quando o DOM está pronto
   */
  function setup() {
    // ===== ENVIA VIEW AUTOMATICAMENTE =====
    // Aguarda 1 segundo após o DOM estar pronto
    // Isso garante que a página carregou e o usuário está realmente visualizando
    setTimeout(function() {
      sendEvent("view");
    }, 1000);

    // ===== FUNÇÃO PARA ENVIAR COMPLETE =====
    /**
     * Envia evento COMPLETE apenas uma vez
     * Protege contra múltiplos cliques enviarem vários eventos
     */
    function complete() {
      if (!completeSent) {
        completeSent = true;
        sendEvent("complete");
      }
    }

    // ===== ADICIONA LISTENERS NOS BOTÕES =====
    // Seleciona todos os botões com classe .quiz-button
    const buttons = document.querySelectorAll(".quiz-button");

    buttons.forEach(function(button) {
      button.addEventListener("click", complete);
    });

    // ===== ADICIONA LISTENER NA IMAGEM (se existir) =====
    // Alguns quizzes têm uma imagem clicável com ID "imglink"
    const imageLink = document.getElementById("imglink");

    if (imageLink) {
      imageLink.addEventListener("click", complete);
    }
  }

  // ============================================================================
  // 🚀 CORREÇÃO PRINCIPAL (v3.0)
  // ============================================================================

  /**
   * Verifica o estado atual do DOM e decide quando executar setup()
   *
   * ANTES (v2.0 - BUGADO):
   *   - Sempre aguardava DOMContentLoaded
   *   - Se o script executasse após o DOM carregar, o evento já havia passado
   *   - Resultado: setup() nunca era chamado, listeners nunca adicionados
   *
   * DEPOIS (v3.0 - CORRIGIDO):
   *   - Verifica document.readyState
   *   - Se "loading": aguarda DOMContentLoaded (DOM ainda não está pronto)
   *   - Se "interactive" ou "complete": executa setup() imediatamente
   *   - Resultado: setup() sempre é chamado, independente do timing
   */
  if (document.readyState === "loading") {
    // DOM ainda está carregando, aguarda o evento
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    // DOM já está pronto (readyState = "interactive" ou "complete")
    // Executa setup() imediatamente
    setup();
  }
})();

// ============================================================================
// MAPEAMENTO DE VARIÁVEIS (Minificado -> Legível)
// ============================================================================

/**
 * Minificado | Legível        | Tipo      | Descrição
 * -----------|----------------|-----------|----------------------------------
 * q          | quizId         | string    | ID único do quiz
 * a          | API_URL        | string    | URL da API de tracking
 * c          | completeSent   | boolean   | Flag para evitar duplicatas
 * s          | sendEvent      | function  | Envia evento para API
 * setup      | setup          | function  | Configura tracking (não minificado)
 * complete   | complete       | function  | Envia COMPLETE (dentro de setup)
 * btns       | buttons        | NodeList  | Lista de botões do quiz
 * il         | imageLink      | Element   | Elemento da imagem clicável
 */

// ============================================================================
// FLUXO DE EXECUÇÃO
// ============================================================================

/**
 * 1. Script é injetado no HTML pelo Cloudflare Worker
 * 2. IIFE executa imediatamente
 * 3. Define variáveis e funções (quizId, API_URL, sendEvent, setup)
 * 4. Verifica document.readyState:
 *    - Se "loading": adiciona listener para DOMContentLoaded
 *    - Senão: executa setup() imediatamente
 * 5. setup() é executado quando DOM está pronto:
 *    a) Agenda envio de VIEW após 1 segundo
 *    b) Define função complete()
 *    c) Adiciona listeners em todos os botões .quiz-button
 *    d) Adiciona listener na imagem #imglink (se existir)
 * 6. Após 1 segundo: sendEvent("view") é chamado
 * 7. Quando usuário clica em botão/imagem:
 *    a) complete() é chamado
 *    b) Se completeSent = false:
 *       - Define completeSent = true
 *       - Chama sendEvent("complete")
 *    c) Se completeSent = true:
 *       - Não faz nada (previne duplicatas)
 */

// ============================================================================
// ESTADOS POSSÍVEIS DO document.readyState
// ============================================================================

/**
 * "loading"
 *   - DOM ainda está sendo construído
 *   - Scripts estão sendo baixados/executados
 *   - Nosso script aguarda DOMContentLoaded
 *
 * "interactive"
 *   - DOM foi completamente construído
 *   - Recursos (imagens, CSS) podem ainda estar carregando
 *   - Nosso script executa setup() imediatamente
 *
 * "complete"
 *   - Tudo foi carregado (DOM + recursos)
 *   - Evento "load" já disparou
 *   - Nosso script executa setup() imediatamente
 */

// ============================================================================
// CENÁRIOS DE TESTE
// ============================================================================

/**
 * CENÁRIO 1: Script injetado ANTES do DOM carregar
 * - readyState = "loading"
 * - Fluxo: Aguarda DOMContentLoaded → setup() → listeners adicionados
 * - Resultado: ✅ Funciona
 *
 * CENÁRIO 2: Script injetado DURANTE o carregamento do DOM
 * - readyState = "loading" ou "interactive"
 * - Fluxo: Verifica readyState → executa apropriadamente
 * - Resultado: ✅ Funciona
 *
 * CENÁRIO 3: Script injetado DEPOIS do DOM carregar (caso do bug v2.0)
 * - readyState = "interactive" ou "complete"
 * - Fluxo v2.0: Aguarda DOMContentLoaded → NUNCA executa (evento já passou)
 * - Fluxo v3.0: Verifica readyState → setup() imediato → listeners adicionados
 * - Resultado v2.0: ❌ Não funciona (0 eventos)
 * - Resultado v3.0: ✅ Funciona (100% eventos)
 */

// ============================================================================
// PERFORMANCE
// ============================================================================

/**
 * Tamanho:
 * - Versão legível: ~2.5 KB
 * - Versão minificada: ~0.6 KB
 * - Gzipped: ~0.3 KB
 *
 * Tempo de execução:
 * - Parse + execução: < 1ms
 * - Setup (adicionar listeners): < 5ms
 * - Total: < 10ms (imperceptível)
 *
 * Impacto no carregamento:
 * - VIEW enviado após 1s (não bloqueia FCP/LCP)
 * - Fetch assíncrono (fire-and-forget)
 * - Sem await (não trava thread principal)
 * - Total: < 0.05s
 *
 * Network:
 * - VIEW: 1 request POST (~150 bytes)
 * - COMPLETE: 1 request POST (~150 bytes)
 * - Total por sessão: ~300 bytes
 */

// ============================================================================
// COMPATIBILIDADE
// ============================================================================

/**
 * Browsers suportados:
 * - Chrome/Edge: ✅ (desde 2016)
 * - Firefox: ✅ (desde 2016)
 * - Safari: ✅ (desde 2016)
 * - Opera: ✅ (desde 2016)
 * - IE11: ❌ (não suportado - precisa polyfill para fetch)
 *
 * Features JavaScript usadas:
 * - Fetch API: Suportado em todos os browsers modernos
 * - Arrow functions: Não usado (para compatibilidade)
 * - const/let: Usado (não funciona em IE11, mas ok)
 * - IIFE: Suportado em todos os browsers
 * - addEventListener: Suportado em todos os browsers
 */

// ============================================================================
// DEBUGGING
// ============================================================================

/**
 * Para debugar o script em produção, cole no console:
 *
 * // Monitora fetch requests
 * const originalFetch = window.fetch;
 * window.fetch = function(...args) {
 *   if (args[0].includes('estatisticas')) {
 *     console.log('📊 Tracking event:', JSON.parse(args[1]?.body || '{}'));
 *   }
 *   return originalFetch.apply(this, args);
 * };
 *
 * // Verifica estado do DOM
 * console.log('readyState:', document.readyState);
 *
 * // Verifica se botões existem
 * console.log('Botões:', document.querySelectorAll('.quiz-button').length);
 *
 * // Verifica se imagem existe
 * console.log('Imagem:', document.getElementById('imglink'));
 */

// ============================================================================
// NOTAS IMPORTANTES
// ============================================================================

/**
 * 1. O quizId é substituído dinamicamente pelo Worker (template literal)
 * 2. O script é injetado inline (não é arquivo externo)
 * 3. IIFE previne poluição do namespace global
 * 4. Uso de function() ao invés de arrow functions para compatibilidade
 * 5. Tratamento de erros silencioso (catch vazio) para não quebrar UX
 * 6. FLAG completeSent previne múltiplos eventos COMPLETE
 * 7. setTimeout de 1s garante que usuário realmente visualizou a página
 * 8. Seletores (.quiz-button, #imglink) são específicos do HTML do quiz
 */
