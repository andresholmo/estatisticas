import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Busca estatísticas agregadas do Supabase usando SQL functions v3 (com datetime)
async function getStatsFromSupabaseV3(range, site, startDate, endDate) {
  try {
    // Chama get_quiz_stats_v3 (dados bucketed para gráficos)
    const { data: bucketed, error: bucketedError } = await supabase.rpc('get_quiz_stats_v3', {
      p_range: range || 'day',
      p_site_domain: site || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (bucketedError) {
      console.error('[Stats] Error calling get_quiz_stats_v3:', bucketedError);
      throw bucketedError;
    }

    // Chama get_quiz_totals_v3 (totais para ranking/tabela)
    const { data: totals, error: totalsError } = await supabase.rpc('get_quiz_totals_v3', {
      p_site_domain: site || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (totalsError) {
      console.error('[Stats] Error calling get_quiz_totals_v3:', totalsError);
      throw totalsError;
    }

    console.log(`[Stats] Fetched ${bucketed?.length || 0} bucketed rows, ${totals?.length || 0} total rows`);
    console.log(`[Stats] Period: ${startDate || 'default'} to ${endDate || 'now'}`);

    return {
      bucketed: bucketed || [],
      totals: totals || []
    };
  } catch (error) {
    console.error('[Stats] Error fetching from Supabase v3:', error);
    throw error;
  }
}

// Formata dados bucketed para o frontend
function formatBucketed(bucketedData) {
  return bucketedData.map(row => ({
    bucket: row.bucket,
    site: row.site,
    quizId: row.quiz_id,
    views: parseInt(row.views) || 0,
    completes: parseInt(row.completes) || 0,
    conversionRate: `${row.conversion_rate || 0}%`
  }));
}

// Formata dados de totais para o frontend
function formatTotals(totalsData) {
  return totalsData.map(row => ({
    site: row.site,
    quizId: row.quiz_id,
    views: parseInt(row.views) || 0,
    completes: parseInt(row.completes) || 0,
    conversionRate: `${row.conversion_rate || 0}%`
  }));
}

// Busca lista de sites disponíveis
async function getSitesList() {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('domain')
      .order('domain');

    if (error) throw error;

    return (data || []).map(s => s.domain);
  } catch (error) {
    console.error('[Stats] Error fetching sites list:', error);
    return [];
  }
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
