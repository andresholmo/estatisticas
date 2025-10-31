import { createClient } from '@supabase/supabase-js';

// Verifica se as variáveis de ambiente estão configuradas
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Se não houver configuração do Supabase, retorna null
// Isso permite que o sistema funcione sem Supabase (fallback para JSON)
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export { supabase };

// Função helper para verificar se Supabase está configurado
export function isSupabaseConfigured() {
  return supabase !== null;
}
