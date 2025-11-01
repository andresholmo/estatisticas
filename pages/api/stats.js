import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Busca estatísticas agregadas do Supabase usando SQL functions v2
async function getStatsFromSupabaseV2(range, site, days) {
  try {
    // Chama get_quiz_stats_v2 (dados bucketed para gráficos)
    const { data: bucketed, error: bucketedError } = await supabase.rpc('get_quiz_stats_v2', {
      p_range: range || 'day',
      p_site_domain: site || null,
      p_days: parseInt(days) || 30
    });

    if (bucketedError) {
      console.error('[Stats] Error calling get_quiz_stats_v2:', bucketedError);
      throw bucketedError;
    }

    // Chama get_quiz_totals_v2 (totais para ranking/tabela)
    const { data: totals, error: totalsError } = await supabase.rpc('get_quiz_totals_v2', {
      p_site_domain: site || null,
      p_days: parseInt(days) || 30
    });

    if (totalsError) {
      console.error('[Stats] Error calling get_quiz_totals_v2:', totalsError);
      throw totalsError;
    }

    console.log(`[Stats] Fetched ${bucketed?.length || 0} bucketed rows, ${totals?.length || 0} total rows`);

    return {
      bucketed: bucketed || [],
      totals: totals || []
    };
  } catch (error) {
    console.error('[Stats] Error fetching from Supabase v2:', error);
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
  // Libera CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { range, site, days, debug, distinct } = req.query;

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
    const selectedDays = parseInt(days) || 30;

    if (!isSupabaseConfigured()) {
      return res.status(200).json({
        range: selectedRange,
        site: site || null,
        days: selectedDays,
        bucketed: [],
        totals: [],
        error: 'Supabase not configured'
      });
    }

    // Busca dados do Supabase
    const { bucketed, totals } = await getStatsFromSupabaseV2(
      selectedRange,
      site || null,
      selectedDays
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
        source: 'supabase-v2',
        range: selectedRange,
        site: site || null,
        days: selectedDays,
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
      days: selectedDays,
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
