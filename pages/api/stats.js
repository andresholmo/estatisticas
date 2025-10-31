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

// Busca estatísticas agregadas direto do Supabase (sem buscar eventos individuais)
async function getStatsFromSupabase(range) {
  const dateLimit = getDateLimit(range);

  // SQL query que faz agregação no banco (muito mais eficiente!)
  let query = `
    SELECT
      quiz_id,
      event,
      COUNT(*) as count
    FROM events
  `;

  if (dateLimit) {
    query += ` WHERE created_at >= '${dateLimit}'`;
  }

  query += `
    GROUP BY quiz_id, event
    ORDER BY quiz_id
  `;

  const { data, error } = await supabase.rpc('get_stats', {
    date_limit: dateLimit
  }).catch(async () => {
    // Fallback: Se RPC não existir, usa query direta
    const { data: rawData, error: rawError } = await supabase
      .from('events')
      .select('quiz_id, event, created_at');

    if (rawError) throw rawError;
    return { data: rawData, error: null };
  });

  if (error) {
    // Se falhar, usa método antigo (busca todos os eventos)
    return await getEventsFromSupabaseOld(range);
  }

  // Se retornou dados agregados, converte para formato esperado
  if (data && Array.isArray(data) && data[0]?.quiz_id && data[0]?.count) {
    return convertAggregatedData(data);
  }

  // Se não retornou dados agregados, usa método antigo
  return await getEventsFromSupabaseOld(range);
}

// Converte dados agregados para array de eventos (para compatibilidade)
function convertAggregatedData(aggregated) {
  const events = [];
  aggregated.forEach(row => {
    const count = parseInt(row.count || row.total || 0);
    for (let i = 0; i < count; i++) {
      events.push({
        quiz_id: row.quiz_id,
        event: row.event,
        created_at: new Date().toISOString() // Data não importa para cálculo
      });
    }
  });
  return events;
}

// Método antigo (busca eventos individuais) - mantido como fallback
async function getEventsFromSupabaseOld(range) {
  const dateLimit = getDateLimit(range);

  // Tenta buscar SEM limite primeiro
  let { data, error } = await supabase
    .from('events')
    .select('quiz_id, event, created_at')
    .gte('created_at', dateLimit || '1900-01-01')
    .order('created_at', { ascending: false })
    .limit(100000); // Tenta buscar até 100k

  if (error) throw error;

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
        events = await getStatsFromSupabase(range);
        source = 'supabase';
      } catch (supabaseError) {
        console.error('Error fetching from Supabase, falling back to JSON:', supabaseError);
        events = getEventsFromJSON(range);
        source = 'json-fallback';
      }
    } else {
      events = getEventsFromJSON(range);
      source = 'json';
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
