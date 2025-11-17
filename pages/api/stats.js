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

// Função para validar e processar datas customizadas
function processCustomDates(startDate, endDate) {
  if (!startDate || !endDate) {
    return { start: null, end: null };
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { start: null, end: null };
    }

    if (start > end) {
      // Se início > fim, inverte
      return { start: endDate, end: startDate };
    }

    return { start: startDate, end: endDate };
  } catch (error) {
    console.error('[Stats] Error processing custom dates:', error);
    return { start: null, end: null };
  }
}

// Busca lista de sites disponíveis
async function getSitesList() {
  try {
    // Tenta buscar da tabela sites
    const { data, error } = await supabase
      .from('sites')
      .select('domain')
      .order('domain');

    if (error) {
      // Se a tabela não existe, tenta buscar domínios únicos dos eventos
      console.log('[Stats] Sites table not found, trying to get from events');
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('site')
        .not('site', 'is', null);

      if (eventsError) {
        console.error('[Stats] Error fetching sites from events:', eventsError);
        return [];
      }

      // Extrai domínios únicos
      const uniqueSites = [...new Set((eventsData || []).map(e => e.site).filter(Boolean))];
      return uniqueSites.sort();
    }

    return (data || []).map(s => s.domain);
  } catch (error) {
    console.error('[Stats] Error fetching sites list:', error);
    return [];
  }
}

// Busca estatísticas agregadas do Supabase usando SQL function
// Isso é MUITO mais eficiente: retorna ~100 linhas ao invés de 45k!
async function getStatsFromSupabase(range, startDate, endDate, site) {
  let dateLimit = null;

  // Prioriza datas customizadas se fornecidas
  if (startDate && endDate) {
    const customDates = processCustomDates(startDate, endDate);
    if (customDates.start && customDates.end) {
      // Usa a data de início como limite (a função SQL filtra >= date_limit)
      // Isso funciona porque a função SQL atual só suporta date_limit simples
      dateLimit = customDates.start;
      console.log(`[Stats] Using custom date range: ${customDates.start} to ${customDates.end}, using start as date_limit`);
    }
  } else {
    // Se não há datas customizadas, usa um período padrão baseado no parâmetro days
    // Se days não foi fornecido, usa 30 dias como padrão
    // Mas se range for fornecido e for um período (7d, 30d), usa ele
    dateLimit = getDateLimit(range);
  }

  console.log(`[Stats] Calling get_quiz_stats RPC with date_limit:`, dateLimit, 'custom:', { startDate, endDate, site });

  // Tenta usar a nova função v2 (com start/end dates) se disponível, senão usa a v1 (com date_limit)
  let data, error;
  
  if (startDate && endDate) {
    const customDates = processCustomDates(startDate, endDate);
    if (customDates.start && customDates.end) {
      // Tenta usar get_quiz_stats_v2 (suporta start/end dates)
      const result = await supabase.rpc('get_quiz_stats_v2', {
        start_date: customDates.start,
        end_date: customDates.end
      });
      data = result.data;
      error = result.error;
      
      // Se a função v2 não existir, usa a v1 com date_limit
      if (error && error.message && error.message.includes('does not exist')) {
        console.log('[Stats] get_quiz_stats_v2 not found, falling back to get_quiz_stats with date_limit');
        const resultV1 = await supabase.rpc('get_quiz_stats', {
          date_limit: customDates.start
        });
        data = resultV1.data;
        error = resultV1.error;
        console.log('[Stats] Note: Using v1 function - endDate filtering not supported');
      }
    } else {
      // Usa função v1 com date_limit
      const result = await supabase.rpc('get_quiz_stats', {
        date_limit: dateLimit
      });
      data = result.data;
      error = result.error;
    }
  } else {
    // Usa função v1 com date_limit
    const result = await supabase.rpc('get_quiz_stats', {
      date_limit: dateLimit
    });
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error('[Stats] RPC error:', error);
    throw error;
  }

  console.log(`[Stats] RPC returned ${data?.length || 0} aggregated rows`);

  // Calcula estatísticas direto dos dados agregados (muito mais eficiente!)
  let stats = calculateStatsFromAggregated(data || []);
  
  // Se há datas customizadas com endDate, precisamos filtrar manualmente
  // porque a função SQL só filtra >= date_limit, não <= endDate
  if (startDate && endDate) {
    const customDates = processCustomDates(startDate, endDate);
    if (customDates.start && customDates.end) {
      // Nota: Como a função SQL retorna dados agregados (não eventos individuais),
      // não podemos filtrar por endDate aqui. A função SQL precisa ser atualizada
      // para suportar start/end dates, ou precisamos buscar eventos individuais.
      // Por enquanto, vamos assumir que date_limit é suficiente.
      console.log(`[Stats] Note: endDate filtering not supported by current SQL function`);
    }
  }
  
  // Se há filtro de site, filtra os resultados
  if (site && site !== 'all') {
    // Nota: A função SQL atual não filtra por site, então precisaríamos buscar eventos individuais
    // Por enquanto, retornamos todos e o frontend pode filtrar se necessário
    // Ou podemos fazer uma query adicional para filtrar por site
  }

  return stats;
}

// Calcula estatísticas a partir de dados agregados (não precisa processar 45k linhas!)
function calculateStatsFromAggregated(aggregatedData) {
  const stats = {};

  // Processa os dados agregados
  aggregatedData.forEach((row) => {
    const quizId = row.quiz_id;
    const event = row.event;
    // A função SQL retorna 'count', não 'total'
    const count = parseInt(row.count || row.total || 0);

    if (!stats[quizId]) {
      stats[quizId] = { views: 0, completes: 0 };
    }

    if (event === 'view') {
      stats[quizId].views = count;
    } else if (event === 'complete') {
      stats[quizId].completes = count;
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
function getEventsFromJSON(range, startDate, endDate) {
  ensureDataFile();

  const fileContent = fs.readFileSync(eventsFile, 'utf8');
  const data = JSON.parse(fileContent);
  let events = data.events || [];

  // Prioriza datas customizadas se fornecidas
  if (startDate && endDate) {
    const customDates = processCustomDates(startDate, endDate);
    if (customDates.start && customDates.end) {
      const start = new Date(customDates.start);
      const end = new Date(customDates.end);
      events = events.filter(e => {
        const eventDate = new Date(e.timestamp || e.created_at);
        return eventDate >= start && eventDate <= end;
      });
      return events;
    }
  }

  // Usa range padrão
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
    // Pega parâmetros do query string
    const { range, site, days, debug, distinct, startDate, endDate } = req.query;

    // Endpoint especial: retorna lista de sites
    if (distinct === 'site') {
      if (!isSupabaseConfigured()) {
        return res.status(200).json({ sites: [] });
      }

      const sites = await getSitesList();
      return res.status(200).json({ sites });
    }

    // Validação de parâmetros
    const validRanges = ['hour', 'day', 'week', '7d', '30d', 'all'];
    let selectedRange = validRanges.includes(range) ? range : 'day';
    
    // Converte ranges antigos para novos
    if (range === '7d' || range === '30d' || range === 'all') {
      // Mantém compatibilidade, mas não usamos para agregação
      selectedRange = 'day';
    }

    // Suporta tanto days (antigo) quanto startDate/endDate (novo)
    let finalStartDate = null;
    let finalEndDate = null;

    if (startDate && endDate) {
      // Modo v3: usa timestamps específicos
      finalStartDate = startDate;
      finalEndDate = endDate;
    } else if (days) {
      // Modo v2: calcula baseado em days
      const daysNum = parseInt(days) || 30;
      finalEndDate = new Date().toISOString();
      finalStartDate = new Date(Date.now() - (daysNum * 24 * 60 * 60 * 1000)).toISOString();
    }

    let stats;
    let source = 'unknown';
    let totalEvents = 0;

    // Busca estatísticas do Supabase (já agregadas) ou JSON local
    if (isSupabaseConfigured()) {
      try {
        // getStatsFromSupabase já retorna as stats calculadas
        stats = await getStatsFromSupabase(selectedRange, finalStartDate, finalEndDate, site);
        source = 'supabase';

        // Calcula total de eventos a partir das stats
        totalEvents = stats.reduce((sum, s) => sum + s.views + s.completes, 0);

        console.log(`[Stats] Source: supabase (RPC), Stats: ${stats.length} quizzes, Total events: ${totalEvents}`);
        if (finalStartDate && finalEndDate) {
          console.log(`[Stats] Custom date range: ${finalStartDate} to ${finalEndDate}`);
        }
      } catch (supabaseError) {
        console.error('Error fetching from Supabase, falling back to JSON:', supabaseError);

        // Fallback: busca do JSON local e calcula stats
        const events = getEventsFromJSON(range, finalStartDate, finalEndDate);
        stats = calculateStats(events);
        source = 'json-fallback';
        totalEvents = events.length;

        console.log(`[Stats] Source: json-fallback, Events: ${totalEvents}`);
      }
    } else {
      // Busca do JSON local e calcula stats
      const events = getEventsFromJSON(range, finalStartDate, finalEndDate);
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
        range: selectedRange,
        site: site || null,
        startDate: finalStartDate,
        endDate: finalEndDate,
        stats: stats
      });
    }

    // Retorna no formato esperado pelo dashboard (com totals e bucketed vazio por enquanto)
    // O dashboard espera { totals: [...], bucketed: [...] }
    return res.status(200).json({
      range: selectedRange,
      site: site || null,
      startDate: finalStartDate,
      endDate: finalEndDate,
      bucketed: [], // Por enquanto vazio, pode ser implementado depois
      totals: stats // Stats formatadas como totals
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
