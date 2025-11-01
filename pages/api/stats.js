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

// Busca estatísticas agregadas do Supabase usando SQL function
// Isso é MUITO mais eficiente: retorna ~100 linhas ao invés de 45k!
async function getStatsFromSupabase(range) {
  const dateLimit = getDateLimit(range);

  console.log(`[Stats] Calling get_quiz_stats RPC with date_limit:`, dateLimit);

  // Chama a função SQL que criamos
  const { data, error } = await supabase.rpc('get_quiz_stats', {
    date_limit: dateLimit
  });

  if (error) {
    console.error('[Stats] RPC error:', error);
    throw error;
  }

  console.log(`[Stats] RPC returned ${data?.length || 0} aggregated rows`);

  // data agora está no formato:
  // [
  //   { quiz_id: 'cbcn', event: 'view', total: 25000 },
  //   { quiz_id: 'cbcn', event: 'complete', total: 11000 },
  //   ...
  // ]

  // Calcula estatísticas direto dos dados agregados (muito mais eficiente!)
  return calculateStatsFromAggregated(data || []);
}

// Calcula estatísticas a partir de dados agregados (não precisa processar 45k linhas!)
function calculateStatsFromAggregated(aggregatedData) {
  const stats = {};

  // Processa os dados agregados
  aggregatedData.forEach((row) => {
    const quizId = row.quiz_id;
    const event = row.event;
    const total = parseInt(row.total || 0);

    if (!stats[quizId]) {
      stats[quizId] = { views: 0, completes: 0 };
    }

    if (event === 'view') {
      stats[quizId].views = total;
    } else if (event === 'complete') {
      stats[quizId].completes = total;
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

    let stats;
    let source = 'unknown';
    let totalEvents = 0;

    // Busca estatísticas do Supabase (já agregadas) ou JSON local
    if (isSupabaseConfigured()) {
      try {
        // getStatsFromSupabase já retorna as stats calculadas (não retorna eventos individuais)
        stats = await getStatsFromSupabase(range);
        source = 'supabase';

        // Calcula total de eventos a partir das stats
        totalEvents = stats.reduce((sum, s) => sum + s.views + s.completes, 0);

        console.log(`[Stats] Source: supabase (RPC), Stats: ${stats.length} quizzes, Total events: ${totalEvents}`);
      } catch (supabaseError) {
        console.error('Error fetching from Supabase, falling back to JSON:', supabaseError);

        // Fallback: busca do JSON local e calcula stats
        const events = getEventsFromJSON(range);
        stats = calculateStats(events);
        source = 'json-fallback';
        totalEvents = events.length;

        console.log(`[Stats] Source: json-fallback, Events: ${totalEvents}`);
      }
    } else {
      // Busca do JSON local e calcula stats
      const events = getEventsFromJSON(range);
      stats = calculateStats(events);
      source = 'json';
      totalEvents = events.length;

      console.log(`[Stats] Source: json, Events: ${totalEvents}`);
    }

    // Se debug=true, retorna informações adicionais
    if (debug === 'true') {
      return res.status(200).json({
        source: source,
        totalEvents: totalEvents,
        totalQuizzes: stats.length,
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
