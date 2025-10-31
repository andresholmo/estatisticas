// Monitor de eventos em tempo real
// Armazena os últimos 50 eventos que chegaram na API

let recentEvents = [];
const MAX_EVENTS = 50;

// Função para adicionar evento ao monitor
export function logEventToMonitor(eventData) {
  recentEvents.unshift({
    ...eventData,
    receivedAt: new Date().toISOString()
  });

  // Mantém apenas os últimos 50
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents = recentEvents.slice(0, MAX_EVENTS);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Agrupa eventos por quizId para análise rápida
  const eventsByQuiz = {};

  recentEvents.forEach(evt => {
    if (!eventsByQuiz[evt.quizId]) {
      eventsByQuiz[evt.quizId] = { views: 0, completes: 0 };
    }
    if (evt.event === 'view') {
      eventsByQuiz[evt.quizId].views++;
    } else if (evt.event === 'complete') {
      eventsByQuiz[evt.quizId].completes++;
    }
  });

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    totalEventsTracked: recentEvents.length,
    maxEvents: MAX_EVENTS,
    summary: eventsByQuiz,
    recentEvents: recentEvents,
    message: recentEvents.length === 0
      ? '⚠️  Nenhum evento recebido ainda. Os scripts de tracking podem não estar funcionando.'
      : `✅ ${recentEvents.length} eventos recebidos recentemente.`
  });
}
