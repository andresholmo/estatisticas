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
async function getEventsFromSupabase(range) {
  let query = supabase
    .from('events')
    .select('quiz_id, event, created_at');

  const dateLimit = getDateLimit(range);
  if (dateLimit) {
    query = query.gte('created_at', dateLimit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

// Busca eventos do JSON local com filtro de data
function getEventsFromJSON(range) {
  // Na Vercel, o sistema de arquivos é read-only
  const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Em produção sem Supabase, retorna array vazio
    console.log('⚠️  Sem dados (Supabase não configurado)');
    return [];
  }

  // Em desenvolvimento, lê do JSON local
  try {
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
  } catch (error) {
    console.error('Erro ao ler JSON:', error);
    return [];
  }
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

  // Previne cache - CRÍTICO para atualizações em tempo real
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // resposta rápida para preflight
  }

  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Pega o range do query string (7d, 30d, ou all)
    const { range } = req.query;

    let events;

    // Busca eventos do Supabase ou JSON local
    if (isSupabaseConfigured()) {
      events = await getEventsFromSupabase(range);
    } else {
      events = getEventsFromJSON(range);
    }

    // Calcula estatísticas
    const stats = calculateStats(events);

    // Retorna estatísticas
    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
