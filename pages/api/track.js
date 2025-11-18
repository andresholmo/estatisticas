import { supabase, isSupabaseConfigured, getDomainFromReq } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// Função para criar hash do IP (privacidade)
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

// Verifica se evento é duplicado (mesma sessão + quiz + evento nos últimos 60s)
async function isDuplicate(sessionId, quizId, event) {
  if (!sessionId) return false; // Se não tem session_id, não pode verificar

  try {
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('session_id', sessionId)
      .eq('quiz_id', quizId)
      .eq('event', event)
      .gte('created_at', sixtySecondsAgo)
      .limit(1);

    if (error) {
      console.error('[Dedup] Error checking duplicate:', error);
      return false; // Em caso de erro, permite o evento
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('[Dedup] Exception checking duplicate:', error);
    return false;
  }
}

// Rate limiting: máximo 10 eventos por IP por minuto
async function isRateLimited(ipHash) {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('ip_hash', ipHash)
      .gte('created_at', oneMinuteAgo);

    if (error) {
      console.error('[RateLimit] Error checking rate limit:', error);
      return false; // Em caso de erro, permite o evento
    }

    const count = data?.length || 0;
    return count >= 10;
  } catch (error) {
    console.error('[RateLimit] Exception checking rate limit:', error);
    return false;
  }
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

// Salva evento no Supabase com site_id, utm_campaign, session_id e ip_hash
async function saveToSupabase(event, quizId, ip, siteId, utmCampaign, sessionId, ipHash) {
  const eventData = {
    quiz_id: quizId,
    event: event,
    site_id: siteId,
    session_id: sessionId,
    ip_hash: ipHash,
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
    const { event, quizId, site: bodySite, utm_campaign, session_id } = req.body;

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
    const ipHash = hashIp(ip);

    let saved = 'unknown';
    let errorDetails = null;
    let siteId = null;

    // Tenta salvar no Supabase
    if (isSupabaseConfigured()) {
      try {
        // 1. Verificar rate limiting (máximo 10 eventos por IP por minuto)
        const rateLimited = await isRateLimited(ipHash);
        if (rateLimited) {
          console.warn('[Track] Rate limited:', { ipHash, quizId, event });
          return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Maximum 10 events per minute.'
          });
        }

        // 2. Verificar se é duplicata (mesma sessão + quiz + evento nos últimos 60s)
        if (session_id) {
          const duplicate = await isDuplicate(session_id, quizId, event);
          if (duplicate) {
            console.log('[Track] Duplicate event blocked:', { session_id, quizId, event });
            // Retorna sucesso mas não salva (evita erro no cliente)
            return res.status(200).json({
              ok: true,
              saved: 'duplicate-skipped',
              event: event,
              quizId: quizId,
              site: site,
              message: 'Duplicate event within 60 seconds'
            });
          }
        }

        // 3. Upsert site para obter site_id
        siteId = await upsertSite(site);

        // 4. Salva evento com site_id, utm_campaign, session_id e ip_hash
        await saveToSupabase(event, quizId, ip, siteId, utm_campaign, session_id, ipHash);

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
