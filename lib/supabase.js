import { createClient } from '@supabase/supabase-js';

// Cache do cliente Supabase (criado sob demanda)
let supabaseClient = null;

// Função para obter o cliente Supabase (lazy initialization)
function getSupabaseClient() {
  // Se já temos o cliente em cache, retorna
  if (supabaseClient !== null) {
    return supabaseClient;
  }

  // Busca as variáveis de ambiente
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

  // Se não houver configuração, retorna null
  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️  Supabase não configurado (variáveis ausentes)');
    return null;
  }

  // Cria e cacheia o cliente
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('✅ Cliente Supabase criado:', supabaseUrl.substring(0, 30) + '...');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Erro ao criar cliente Supabase:', error);
    return null;
  }
}

// Exporta o getter como propriedade
export const supabase = new Proxy({}, {
  get: function(target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não está configurado');
    }
    return client[prop];
  }
});

// Função helper para verificar se Supabase está configurado
export function isSupabaseConfigured() {
  const client = getSupabaseClient();
  return client !== null;
}
