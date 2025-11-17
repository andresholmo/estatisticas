import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// Fallback: busca campanhas diretamente da tabela
async function getCampaignsFromDirectQuery(quizId, startDate, endDate, res) {
  try {
    let query = supabase
      .from('events')
      .select('utm_campaign, event')
      .eq('quiz_id', quizId)
      .limit(1000); // Limite do Supabase

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Campaigns] Direct query failed:', error);
      return res.status(200).json({
        quizId,
        startDate,
        endDate,
        campaigns: [],
        totals: {
          views: 0,
          completes: 0,
          conversionRate: '0.00%'
        },
        error: 'Direct query failed'
      });
    }

    // Calcula stats por campanha
    const campaignStats = {};
    (data || []).forEach((row) => {
      const campaign = row.utm_campaign || 'Sem campanha';
      const event = row.event;

      if (!campaignStats[campaign]) {
        campaignStats[campaign] = { views: 0, completes: 0 };
      }

      if (event === 'view') {
        campaignStats[campaign].views++;
      } else if (event === 'complete') {
        campaignStats[campaign].completes++;
      }
    });

    const campaigns = Object.entries(campaignStats).map(([campaign, data]) => {
      const conversionRate = data.views > 0
        ? ((data.completes / data.views) * 100).toFixed(2)
        : '0.00';

      return {
        campaign,
        views: data.views,
        completes: data.completes,
        conversionRate: `${conversionRate}%`
      };
    }).sort((a, b) => b.views - a.views);

    const totalViews = campaigns.reduce((sum, c) => sum + c.views, 0);
    const totalCompletes = campaigns.reduce((sum, c) => sum + c.completes, 0);
    const overallConversionRate = totalViews > 0
      ? ((totalCompletes / totalViews) * 100).toFixed(2)
      : '0.00';

    console.log('[Campaigns] Direct query returned', campaigns.length, 'campaigns (limited to 1000 events)');

    return res.status(200).json({
      quizId,
      startDate,
      endDate,
      campaigns,
      totals: {
        views: totalViews,
        completes: totalCompletes,
        conversionRate: `${overallConversionRate}%`
      },
      warning: 'Using direct query (limited to 1000 events). Create get_quiz_campaigns function for better performance.'
    });
  } catch (error) {
    console.error('[Campaigns] Direct query error:', error);
    return res.status(200).json({
      quizId,
      startDate,
      endDate,
      campaigns: [],
      totals: {
        views: 0,
        completes: 0,
        conversionRate: '0.00%'
      },
      error: 'Direct query failed'
    });
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
    const { data, error } = await supabase.rpc('get_quiz_campaigns', {
      p_quiz_id: quizId,
      p_start_date: finalStartDate,
      p_end_date: finalEndDate
    });

    if (error) {
      // Se função não existe ou dá timeout, tenta buscar diretamente da tabela
      if (error.code === '57014' || error.message?.includes('does not exist') || error.message?.includes('timeout')) {
        console.log('[Campaigns] Function not found or timeout, trying direct query');
        return await getCampaignsFromDirectQuery(quizId, finalStartDate, finalEndDate, res);
      }
      console.error('[Campaigns] RPC error:', error);
      throw error;
    }

    // Formata dados para o frontend
    const campaigns = (data || []).map(row => ({
      campaign: row.utm_campaign || 'Sem campanha',
      views: parseInt(row.views) || 0,
      completes: parseInt(row.completes) || 0,
      conversionRate: `${parseFloat(row.conversion_rate || 0).toFixed(2)}%`
    }));

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

