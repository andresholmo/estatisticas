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
    if (isSupabaseConfigured()) {
      await saveToSupabase(event, quizId, ip);
    } else {
      saveToJSON(event, quizId, ip);
    }

    // Resposta rápida
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error tracking event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
