import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      supabaseConfigured: isSupabaseConfigured(),
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_KEY,
        hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasPublicKey: !!process.env.NEXT_PUBLIC_SUPABASE_KEY,
      }
    };

    if (testResults.supabaseConfigured) {
      // Testa inserção
      console.log('🧪 Testando inserção no Supabase...');

      try {
        const testEvent = {
          quiz_id: 'test',
          event: 'view',
          ip: 'test',
        };

        const { data: insertData, error: insertError } = await supabase
          .from('events')
          .insert([testEvent])
          .select();

        if (insertError) {
          testResults.insert = {
            success: false,
            error: insertError.message,
            code: insertError.code,
            details: insertError.details
          };
        } else {
          testResults.insert = {
            success: true,
            data: insertData
          };

          // Agora tenta ler de volta
          const { data: selectData, error: selectError } = await supabase
            .from('events')
            .select('*')
            .eq('quiz_id', 'test')
            .order('created_at', { ascending: false })
            .limit(5);

          if (selectError) {
            testResults.select = {
              success: false,
              error: selectError.message
            };
          } else {
            testResults.select = {
              success: true,
              count: selectData?.length || 0,
              latestEvents: selectData
            };
          }
        }
      } catch (dbError) {
        testResults.insert = {
          success: false,
          error: dbError.message,
          stack: dbError.stack
        };
      }
    } else {
      testResults.error = 'Supabase não está configurado';
    }

    return res.status(200).json(testResults);

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return res.status(500).json({
      error: 'Erro ao executar teste',
      message: error.message,
      stack: error.stack
    });
  }
}
