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

// Função helper para extrair domínio da requisição
export function getDomainFromReq(req) {
  // Tenta pegar do header origin primeiro
  let domain = req.headers['origin'];

  if (!domain) {
    // Se não tiver origin, tenta referer
    domain = req.headers['referer'] || req.headers['referrer'];
  }

  if (domain) {
    try {
      // Remove protocolo e path, fica só com o domínio
      const url = new URL(domain);
      return url.hostname;
    } catch (e) {
      // Se falhar o parse, tenta extrair manualmente
      domain = domain.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
      return domain;
    }
  }

  // Fallback: tenta pegar do host header
  domain = req.headers['host'];

  return domain || 'unknown';
}
