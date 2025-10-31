import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de eventos
const eventsFile = path.join(process.cwd(), 'data', 'events.json');

// Função para garantir que o arquivo existe
function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(eventsFile)) {
    fs.writeFileSync(eventsFile, JSON.stringify({ events: [] }, null, 2));
  }
}

// Função para calcular estatísticas
function calculateStats(events) {
  const stats = {};

  // Agrupa eventos por quizId
  events.forEach(({ event, quizId }) => {
    if (!stats[quizId]) {
      stats[quizId] = { views: 0, completes: 0 };
    }

    if (event === 'view') {
      stats[quizId].views++;
    } else if (event === 'complete') {
      stats[quizId].completes++;
    }
  });

  // Converte para array e adiciona taxa de conversão
  return Object.entries(stats).map(([quizId, data]) => {
    const conversionRate = data.views > 0
      ? ((data.completes / data.views) * 100).toFixed(1)
      : '0.0';

    return {
      quizId,
      views: data.views,
      completes: data.completes,
      conversionRate: `${conversionRate}%`
    };
  }).sort((a, b) => b.views - a.views); // Ordena por views (maior primeiro)
}

export default async function handler(req, res) {
  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Garante que o arquivo existe
    ensureDataFile();

    // Lê os eventos
    const fileContent = fs.readFileSync(eventsFile, 'utf8');
    const data = JSON.parse(fileContent);

    // Calcula estatísticas
    const stats = calculateStats(data.events || []);

    // Retorna estatísticas
    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
