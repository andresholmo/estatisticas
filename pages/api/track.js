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
  const { error } = await supabase
    .from('events')
    .insert([
      {
        quiz_id: quizId,
        event: event,
        ip: ip,
      }
    ]);

  if (error) {
    throw error;
  }
}

// Salva evento no JSON local (fallback)
function saveToJSON(event, quizId, ip) {
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

    let saved = 'unknown';
    let errorDetails = null;

    // Tenta salvar no Supabase, senão usa JSON local
    if (isSupabaseConfigured()) {
      try {
        await saveToSupabase(event, quizId, ip);
        saved = 'supabase';
      } catch (supabaseError) {
        console.error('Supabase error, falling back to JSON:', supabaseError);
        errorDetails = supabaseError.message;
        saveToJSON(event, quizId, ip);
        saved = 'json-fallback';
      }
    } else {
      saveToJSON(event, quizId, ip);
      saved = 'json';
    }

    // Resposta com informação de onde foi salvo
    return res.status(200).json({
      ok: true,
      saved: saved,
      event: event,
      quizId: quizId,
      timestamp: new Date().toISOString(),
      error: errorDetails
    });

  } catch (error) {
    console.error('Error tracking event:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
