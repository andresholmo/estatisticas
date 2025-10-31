import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de eventos (fallback)
const eventsFile = path.join(process.cwd(), 'data', 'events.json');

// Função para garantir que o diretório e arquivo existam (fallback)
function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(eventsFile)) {
    fs.writeFileSync(eventsFile, JSON.stringify({ events: [] }, null, 2));
  }
}

// Função para obter o IP do usuário
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  return ip || 'unknown';
}

// Salva evento no Supabase
async function saveToSupabase(event, quizId, ip) {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          quiz_id: quizId,
          event: event,
          ip: ip,
        }
      ])
      .select();

    if (error) {
      console.error('❌ Erro do Supabase:', error);
      throw error;
    }

    console.log('✅ Dado inserido no Supabase:', data);
    return data;
  } catch (err) {
    console.error('❌ Exceção ao salvar no Supabase:', err);
    throw err;
  }
}

// Salva evento no JSON local (fallback)
function saveToJSON(event, quizId, ip) {
  // Na Vercel, o sistema de arquivos é read-only
  // Vamos verificar se estamos em ambiente de produção
  const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Em produção sem Supabase, apenas loga (não persiste)
    console.log('⚠️  Evento não persistido (Supabase não configurado):', {
      event,
      quizId,
      ip,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Em desenvolvimento, salva no JSON local
  try {
    ensureDataFile();

    const fileContent = fs.readFileSync(eventsFile, 'utf8');
    const data = JSON.parse(fileContent);

    const newEvent = {
      event,
      quizId,
      timestamp: new Date().toISOString(),
      ip
    };

    data.events.push(newEvent);
    fs.writeFileSync(eventsFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erro ao salvar em JSON:', error);
    // Não lança erro, apenas loga
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

  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, quizId } = req.body;

    // Validação básica
    if (!event || !quizId) {
      return res.status(400).json({ error: 'Missing event or quizId' });
    }

    if (!['view', 'complete'].includes(event)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const ip = getClientIp(req);

    // Tenta salvar no Supabase, senão usa JSON local
    const supabaseConfigured = isSupabaseConfigured();
    console.log(`📝 Salvando evento: ${event} | Quiz: ${quizId} | Supabase: ${supabaseConfigured ? 'SIM' : 'NÃO'}`);

    if (supabaseConfigured) {
      console.log('💾 Tentando salvar no Supabase...');
      try {
        const result = await saveToSupabase(event, quizId, ip);
        console.log('✅ Salvo no Supabase com sucesso:', result);
        return res.status(200).json({
          ok: true,
          saved: 'supabase',
          event,
          quizId,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.error('❌ ERRO ao salvar no Supabase:', saveError);
        // Retorna erro mas com status 200 para não bloquear o tracking
        return res.status(200).json({
          ok: false,
          saved: 'error',
          error: saveError.message,
          event,
          quizId
        });
      }
    } else {
      console.log('⚠️  Supabase não configurado, usando fallback');
      saveToJSON(event, quizId, ip);
      return res.status(200).json({ ok: true, saved: 'json', event, quizId });
    }

  } catch (error) {
    console.error('Error tracking event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
