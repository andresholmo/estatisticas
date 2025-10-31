import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de eventos
const eventsFile = path.join(process.cwd(), 'data', 'events.json');

// Função para garantir que o diretório e arquivo existam
function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  // Cria diretório se não existir
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Cria arquivo se não existir
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

    // Garante que o arquivo existe
    ensureDataFile();

    // Lê os eventos existentes
    const fileContent = fs.readFileSync(eventsFile, 'utf8');
    const data = JSON.parse(fileContent);

    // Adiciona novo evento
    const newEvent = {
      event,
      quizId,
      timestamp: new Date().toISOString(),
      ip: getClientIp(req)
    };

    data.events.push(newEvent);

    // Salva de volta no arquivo
    fs.writeFileSync(eventsFile, JSON.stringify(data, null, 2));

    // Resposta rápida
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error tracking event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
