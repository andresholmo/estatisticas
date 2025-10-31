import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de eventos (fallback)
const eventsFile = path.join(process.cwd(), 'data', 'events.json');

// Função para garantir que o arquivo existe (fallback)
function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(eventsFile)) {
    fs.writeFileSync(eventsFile, JSON.stringify({ events: [] }, null, 2));
  }
}

// Função para calcular a data limite baseada no range
function getDateLimit(range) {
  if (!range || range === 'all') {
    return null;
  }

  const now = new Date();

  if (range === '7d') {
    now.setDate(now.getDate() - 7);
  } else if (range === '30d') {
    now.setDate(now.getDate() - 30);
  } else {
    return null;
  }

  return now.toISOString();
}

// Busca eventos do Supabase com filtro de data
// NOTA: Supabase JS client tem limite de ~1000-10000 linhas
// Para mais que isso, precisa usar SQL function (ver SUPABASE_SQL_FUNCTION.md)
async function getEventsFromSupabase(range) {
  const dateLimit = getDateLimit(range);

  // Monta a query
  let query = supabase
    .from('events')
    .select('quiz_id, event, created_at');

  // Aplica filtro de data se houver
  if (dateLimit) {
    query = query.gte('created_at', dateLimit);
  }

  // Ordena por data (mais recentes primeiro)
  query = query.order('created_at', { ascending: false });

  // Tenta buscar até 100k eventos (máximo que o Supabase permite)
  // Se tiver mais que 100k, só vai pegar os 100k mais recentes
  query = query.limit(100000);

  const { data, error } = await query;

  if (error) {
    console.error('Supabase query error:', error);
    throw error;
  }

  console.log(`[Stats] Fetched ${data?.length || 0} events from Supabase`);

  return data || [];
}

// Busca eventos do JSON local com filtro de data
function getEventsFromJSON(range) {
  ensureDataFile();

  const fileContent = fs.readFileSync(eventsFile, 'utf8');
  const data = JSON.parse(fileContent);
  let events = data.events || [];

  const dateLimit = getDateLimit(range);
  if (dateLimit) {
    events = events.filter(e => {
      const eventDate = new Date(e.timestamp || e.created_at);
      return eventDate >= new Date(dateLimit);
    });
  }

  return events;
}

// Função para calcular estatísticas
function calculateStats(events) {
  const stats = {};

  // Agrupa eventos por quizId
  events.forEach((item) => {
    const event = item.event;
    const quizId = item.quiz_id || item.quizId;

    if (!stats[quizId]) {
      stats[quizId] = { views: 0, completes: 0 };
    }

    if (event === 'view') {
      stats[quizId].views++;
    } else if (event === 'complete') {
      stats[quizId].completes++;
    }
  });

  // Converte para array e adiciona taxa de conversão
  return Object.entries(stats).map(([quizId, data]) => {
    const conversionRate = data.views > 0
      ? ((data.completes / data.views) * 100).toFixed(1)
      : '0.0';

    return {
      quizId,
      views: data.views,
      completes: data.completes,
      conversionRate: `${conversionRate}%`
    };
  }).sort((a, b) => b.views - a.views); // Ordena por views (maior primeiro)
}

export default async function handler(req, res) {
  // Libera CORS para qualquer domínio (ou restrinja se quiser)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // resposta rápida para preflight
  }

  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Pega o range do query string (7d, 30d, ou all)
    const { range, debug } = req.query;

    let events;
    let source = 'unknown';

    // Busca eventos do Supabase ou JSON local
    if (isSupabaseConfigured()) {
      try {
        events = await getEventsFromSupabase(range);
        source = 'supabase';
        console.log(`[Stats] Source: supabase, Events: ${events.length}`);
      } catch (supabaseError) {
        console.error('Error fetching from Supabase, falling back to JSON:', supabaseError);
        events = getEventsFromJSON(range);
        source = 'json-fallback';
        console.log(`[Stats] Source: json-fallback, Events: ${events.length}`);
      }
    } else {
      events = getEventsFromJSON(range);
      source = 'json';
      console.log(`[Stats] Source: json, Events: ${events.length}`);
    }

    // Calcula estatísticas
    const stats = calculateStats(events);

    // Se debug=true, retorna informações adicionais
    if (debug === 'true') {
      return res.status(200).json({
        source: source,
        totalEvents: events.length,
        supabaseConfigured: isSupabaseConfigured(),
        range: range || 'all',
        stats: stats
      });
    }

    // Retorna estatísticas
    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
