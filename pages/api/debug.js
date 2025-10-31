import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default async function handler(req, res) {
  // Permite CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const debug = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      supabaseUrlConfigured: !!process.env.SUPABASE_URL,
      supabaseKeyConfigured: !!process.env.SUPABASE_KEY,
      supabasePublicUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabasePublicKeyConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_KEY,
    },
    supabase: {
      configured: isSupabaseConfigured(),
      clientExists: supabase !== null,
    },
    tests: {}
  };

  // Teste 1: Verificar se consegue conectar no Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('count')
        .limit(1);

      debug.tests.supabaseConnection = {
        success: !error,
        error: error ? error.message : null,
        canQuery: !error,
      };
    } catch (err) {
      debug.tests.supabaseConnection = {
        success: false,
        error: err.message,
        canQuery: false,
      };
    }

    // Teste 2: Tentar inserir um evento de teste
    try {
      const testEvent = {
        quiz_id: 'debug-test',
        event: 'view',
        ip: 'debug',
      };

      const { data, error } = await supabase
        .from('events')
        .insert([testEvent])
        .select();

      debug.tests.supabaseInsert = {
        success: !error,
        error: error ? error.message : null,
        insertedId: data?.[0]?.id || null,
      };

      // Se inseriu com sucesso, remove o evento de teste
      if (!error && data?.[0]?.id) {
        await supabase
          .from('events')
          .delete()
          .eq('quiz_id', 'debug-test');
      }
    } catch (err) {
      debug.tests.supabaseInsert = {
        success: false,
        error: err.message,
      };
    }

    // Teste 3: Contar eventos existentes
    try {
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      debug.tests.eventCount = {
        success: !error,
        count: count,
        error: error ? error.message : null,
      };
    } catch (err) {
      debug.tests.eventCount = {
        success: false,
        error: err.message,
      };
    }
  } else {
    debug.tests.supabaseConnection = {
      success: false,
      error: 'Supabase not configured (missing env vars)',
    };
  }

  return res.status(200).json(debug);
}
