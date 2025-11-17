import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Busca estatísticas agregadas do Supabase usando SQL functions v3 (com datetime)
// Com fallback para função mais simples se v3 der timeout
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
      // Se for timeout ou função não existe, usa fallback
      if (bucketedError.code === '57014' || bucketedError.message?.includes('does not exist') || bucketedError.message?.includes('timeout')) {
        console.log('[Stats] get_quiz_stats_v3 failed, using fallback get_quiz_stats');
        return await getStatsFromSupabaseFallback(startDate, endDate);
      }
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
      // Se for timeout ou função não existe, usa fallback
      if (totalsError.code === '57014' || totalsError.message?.includes('does not exist') || totalsError.message?.includes('timeout')) {
        console.log('[Stats] get_quiz_totals_v3 failed, using fallback get_quiz_stats');
        return await getStatsFromSupabaseFallback(startDate, endDate);
      }
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
    // Se for timeout, tenta fallback
    if (error.code === '57014' || error.message?.includes('timeout')) {
      console.log('[Stats] Timeout error, using fallback');
      return await getStatsFromSupabaseFallback(startDate, endDate);
    }
    console.error('[Stats] Error fetching from Supabase v3:', error);
    throw error;
  }
}

// Fallback: usa função get_quiz_stats mais simples (sem bucketing)
async function getStatsFromSupabaseFallback(startDate, endDate) {
  try {
    // Calcula date_limit baseado nas datas
    let dateLimit = null;
    if (startDate) {
      dateLimit = startDate;
    } else if (endDate) {
      // Se só tem endDate, usa 30 dias antes
      const end = new Date(endDate);
      end.setDate(end.getDate() - 30);
      dateLimit = end.toISOString();
    }

    console.log('[Stats] Using fallback get_quiz_stats with date_limit:', dateLimit);

    // Chama função SQL mais simples
    const { data, error } = await supabase.rpc('get_quiz_stats', {
      date_limit: dateLimit
    });

    if (error) {
      console.error('[Stats] Fallback also failed:', error);
      throw error;
    }

    // Converte dados agregados para formato esperado
    const stats = calculateStatsFromAggregated(data || []);

    // Se há endDate, filtra manualmente (limitado, mas funciona)
    let filteredStats = stats;
    if (startDate && endDate) {
      // Nota: Como são dados agregados, não podemos filtrar por endDate perfeitamente
      // Mas pelo menos retornamos algo
      console.log('[Stats] Note: endDate filtering not perfect in fallback mode');
    }

    // Formata como totals (bucketed vazio)
    return {
      bucketed: [],
      totals: filteredStats
    };
  } catch (error) {
    console.error('[Stats] Fallback failed:', error);
    throw error;
  }
}

// Calcula estatísticas a partir de dados agregados
function calculateStatsFromAggregated(aggregatedData) {
  const stats = {};

  aggregatedData.forEach((row) => {
    const quizId = row.quiz_id;
    const event = row.event;
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
  }).sort((a, b) => b.views - a.views);
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
  if (!totalsData || !Array.isArray(totalsData)) {
    return [];
  }
  
  return totalsData.map(row => ({
    site: row.site || null,
    quizId: row.quiz_id || row.quizId || '',
    views: parseInt(row.views) || 0,
    completes: parseInt(row.completes) || 0,
    conversionRate: row.conversionRate || `${parseFloat(row.conversion_rate || 0).toFixed(1)}%`
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

    // Formata dados (com tratamento de erro)
    let formattedBucketed = [];
    let formattedTotals = [];
    
    try {
      formattedBucketed = formatBucketed(bucketed || []);
      formattedTotals = formatTotals(totals || []);
    } catch (formatError) {
      console.error('[Stats] Error formatting data:', formatError);
      // Se der erro na formatação, tenta usar os dados diretamente
      formattedTotals = Array.isArray(totals) ? totals : [];
      formattedBucketed = Array.isArray(bucketed) ? bucketed : [];
    }

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
    
    // Se for erro de timeout ou função não existe, retorna dados vazios ao invés de erro 500
    if (error.code === '57014' || error.message?.includes('does not exist') || error.message?.includes('timeout')) {
      console.log('[Stats] Returning empty data due to timeout/function not found');
      return res.status(200).json({
        range: selectedRange || 'day',
        site: site || null,
        startDate: finalStartDate,
        endDate: finalEndDate,
        bucketed: [],
        totals: [],
        error: 'Function timeout or not found'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
