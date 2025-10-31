import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default async function handler(req, res) {
  // Libera CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        isProduction: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
      },
      supabase: {
        configured: isSupabaseConfigured(),
        hasUrl: !!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_KEY,
        urlPrefix: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 20) + '...' : 'NOT SET',
      },
      auth: {
        hasAuthToken: !!process.env.AUTH_TOKEN,
      }
    };

    // Tenta fazer uma query simples no Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data, error, count } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: false })
          .limit(5);

        diagnostics.supabase.testQuery = {
          success: !error,
          error: error ? error.message : null,
          recordCount: count,
          sampleData: data ? data.length : 0,
        };
      } catch (err) {
        diagnostics.supabase.testQuery = {
          success: false,
          error: err.message,
        };
      }
    }

    return res.status(200).json(diagnostics);

  } catch (error) {
    return res.status(500).json({
      error: 'Diagnostic failed',
      message: error.message,
    });
  }
}
