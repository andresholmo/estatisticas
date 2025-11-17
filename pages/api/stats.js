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
    const validRanges = ['hour', 'day', 'week'];
    const selectedRange = validRanges.includes(range) ? range : 'day';

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

    if (!isSupabaseConfigured()) {
      return res.status(200).json({
        range: selectedRange,
        site: site || null,
        startDate: finalStartDate,
        endDate: finalEndDate,
        bucketed: [],
        totals: [],
        error: 'Supabase not configured'
      });
    }

    // Busca dados do Supabase v3
    const { bucketed, totals } = await getStatsFromSupabaseV3(
      selectedRange,
      site || null,
      finalStartDate,
      finalEndDate
    );

    // Formata dados
    const formattedBucketed = formatBucketed(bucketed);
    const formattedTotals = formatTotals(totals);

    // Calcula totais gerais
    const totalEvents = formattedTotals.reduce((sum, t) => sum + t.views + t.completes, 0);
    const totalViews = formattedTotals.reduce((sum, t) => sum + t.views, 0);
    const totalCompletes = formattedTotals.reduce((sum, t) => sum + t.completes, 0);
    const overallConversionRate = totalViews > 0
      ? ((totalCompletes / totalViews) * 100).toFixed(1)
      : '0.0';

    // Se debug=true, retorna informações adicionais
    if (debug === 'true') {
      return res.status(200).json({
        source: 'supabase-v3',
        range: selectedRange,
        site: site || null,
        startDate: finalStartDate,
        endDate: finalEndDate,
        totalEvents,
        totalViews,
        totalCompletes,
        overallConversionRate: `${overallConversionRate}%`,
        totalQuizzes: formattedTotals.length,
        bucketed: formattedBucketed,
        totals: formattedTotals
      });
    }

    // Resposta normal
    return res.status(200).json({
      range: selectedRange,
      site: site || null,
      startDate: finalStartDate,
      endDate: finalEndDate,
      bucketed: formattedBucketed,
      totals: formattedTotals
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
