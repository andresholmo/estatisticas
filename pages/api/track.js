import { supabase, isSupabaseConfigured, getDomainFromReq } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de eventos (fallback para dev)
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

// Upsert site e retorna site_id
async function upsertSite(domain) {
  try {
    // Chama função SQL upsert_site
    const { data, error } = await supabase.rpc('upsert_site', {
      p_domain: domain
    });

    if (error) {
      console.error('Error upserting site:', error);
      throw error;
    }

    return data; // Retorna o UUID do site
  } catch (error) {
    console.error('Failed to upsert site:', error);
    // Fallback: tenta inserir diretamente
    const { data: siteData, error: insertError } = await supabase
      .from('sites')
      .upsert({ domain }, { onConflict: 'domain' })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return siteData.id;
  }
}

// Salva evento no Supabase com site_id e utm_campaign
async function saveToSupabase(event, quizId, ip, siteId, utmCampaign) {
  const eventData = {
    quiz_id: quizId,
    event: event,
    ip: ip,
    site_id: siteId,
  };

  // Adiciona utm_campaign apenas se fornecido
  if (utmCampaign) {
    eventData.utm_campaign = utmCampaign;
  }

  const { error } = await supabase
    .from('events')
    .insert([eventData]);

  if (error) {
    throw error;
  }
}

// Salva evento no JSON local (fallback para dev)
function saveToJSON(event, quizId, ip, site) {
  ensureDataFile();

  const fileContent = fs.readFileSync(eventsFile, 'utf8');
  const data = JSON.parse(fileContent);

  const newEvent = {
    event,
    quizId,
    site,
    timestamp: new Date().toISOString(),
    ip
  };

  data.events.push(newEvent);
  fs.writeFileSync(eventsFile, JSON.stringify(data, null, 2));
}

export default async function handler(req, res) {
  // Libera CORS para qualquer domínio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, quizId, site: bodySite, utm_campaign } = req.body;

    // Validação básica
    if (!event || !quizId) {
      return res.status(400).json({ error: 'Missing event or quizId' });
    }

    if (!['view', 'complete'].includes(event)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // Determina o site: usa body.site OU infere dos headers
    const site = bodySite || getDomainFromReq(req);

    const ip = getClientIp(req);

    let saved = 'unknown';
    let errorDetails = null;
    let siteId = null;

    // Tenta salvar no Supabase
    if (isSupabaseConfigured()) {
      try {
        // 1. Upsert site para obter site_id
        siteId = await upsertSite(site);

        // 2. Salva evento com site_id e utm_campaign
        await saveToSupabase(event, quizId, ip, siteId, utm_campaign);

        saved = 'supabase';
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
        errorDetails = supabaseError.message;

        // Fallback: salva no JSON apenas em dev
        if (process.env.NODE_ENV === 'development') {
          saveToJSON(event, quizId, ip, site);
          saved = 'json-fallback';
        } else {
          // Em produção sem Supabase: apenas loga e retorna ok
          console.log('[Track] Production without Supabase:', { event, quizId, site });
          saved = 'logged';
        }
      }
    } else {
      // Supabase não configurado
      if (process.env.NODE_ENV === 'development') {
        saveToJSON(event, quizId, ip, site);
        saved = 'json';
      } else {
        console.log('[Track] No Supabase configured:', { event, quizId, site });
        saved = 'logged';
      }
    }

    // Resposta com informação de onde foi salvo
    return res.status(200).json({
      ok: true,
      saved: saved,
      event: event,
      quizId: quizId,
      site: site,
      siteId: siteId,
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
