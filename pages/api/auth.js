import crypto from 'crypto';

// Função para gerar token
function generateToken(password) {
  const timestamp = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(password + timestamp)
    .digest('hex');

  return `${hash}.${timestamp}`;
}

// Função para validar token
function validateToken(token, password) {
  if (!token) return false;

  try {
    const [hash, timestamp] = token.split('.');
    const tokenAge = Date.now() - parseInt(timestamp);

    // Token expira em 24 horas (86400000 ms)
    if (tokenAge > 86400000) {
      return false;
    }

    const expectedHash = crypto
      .createHash('sha256')
      .update(password + timestamp)
      .digest('hex');

    return hash === expectedHash;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // Libera CORS para qualquer domínio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password, token, action } = req.body;

    // Se AUTH_TOKEN não estiver configurado, bloqueia o acesso
    const authToken = process.env.AUTH_TOKEN;

    if (!authToken) {
      return res.status(503).json({
        error: 'AUTH_TOKEN não configurado',
        message: 'Configure a variável de ambiente AUTH_TOKEN para habilitar a autenticação'
      });
    }

    // Ação: login
    if (action === 'login') {
      if (!password) {
        return res.status(400).json({ error: 'Senha não fornecida' });
      }

      // Valida senha contra AUTH_TOKEN
      if (password === authToken) {
        const token = generateToken(password);
        return res.status(200).json({
          success: true,
          token,
          message: 'Autenticação bem-sucedida'
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Senha incorreta'
        });
      }
    }

    // Ação: verify (verifica se token é válido)
    if (action === 'verify') {
      if (!token) {
        return res.status(400).json({ error: 'Token não fornecido' });
      }

      const isValid = validateToken(token, authToken);

      if (isValid) {
        return res.status(200).json({
          success: true,
          message: 'Token válido'
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Token inválido ou expirado'
        });
      }
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (error) {
    console.error('Error in auth:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
