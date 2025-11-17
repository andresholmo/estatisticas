import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

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
    const { quizId } = req.query;
    const { startDate, endDate } = req.query;

    if (!quizId) {
      return res.status(400).json({ error: 'Missing quizId' });
    }

    if (!isSupabaseConfigured()) {
      return res.status(200).json({
        quizId,
        campaigns: [],
        error: 'Supabase not configured'
      });
    }

    // Prepara parâmetros de data
    const finalStartDate = startDate || null;
    const finalEndDate = endDate || null;

    // Chama função SQL get_quiz_campaigns
    console.log('[Campaigns] Calling get_quiz_campaigns with:', { quizId, finalStartDate, finalEndDate });
    
    const { data, error } = await supabase.rpc('get_quiz_campaigns', {
      p_quiz_id: quizId,
      p_start_date: finalStartDate,
      p_end_date: finalEndDate
    });

    if (error) {
      console.error('[Campaigns] RPC error:', error);
      throw error;
    }

    console.log('[Campaigns] RPC returned', data?.length || 0, 'rows');
    console.log('[Campaigns] First row sample:', data?.[0]);

    // Formata dados para o frontend
    // A função SQL retorna: utm_campaign, views, completes, conversion_rate
    const campaigns = (data || []).map(row => {
      // Log para debug
      console.log('[Campaigns] Processing row:', row);
      
      return {
        campaign: row.utm_campaign || 'Sem campanha',
        views: parseInt(row.views) || 0,
        completes: parseInt(row.completes) || 0,
        conversionRate: `${parseFloat(row.conversion_rate || 0).toFixed(2)}%`
      };
    });

    console.log('[Campaigns] Formatted', campaigns.length, 'campaigns');

    // Calcula totais
    const totalViews = campaigns.reduce((sum, c) => sum + c.views, 0);
    const totalCompletes = campaigns.reduce((sum, c) => sum + c.completes, 0);
    const overallConversionRate = totalViews > 0
      ? ((totalCompletes / totalViews) * 100).toFixed(2)
      : '0.00';

    return res.status(200).json({
      quizId,
      startDate: finalStartDate,
      endDate: finalEndDate,
      campaigns,
      totals: {
        views: totalViews,
        completes: totalCompletes,
        conversionRate: `${overallConversionRate}%`
      }
    });

  } catch (error) {
    console.error('Error getting campaigns:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

