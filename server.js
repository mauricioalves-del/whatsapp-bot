const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('=== Iniciando server.js ===');

const app = express();
app.use(express.json());

const API_TOKEN = process.env.API_TOKEN;
const PORT = process.env.PORT || 3000;

if (!API_TOKEN) {
  console.error('ERRO: defina a variável de ambiente API_TOKEN antes de iniciar.');
  process.exit(1);
}

// Sessão persistida em disco (./session) — evita escanear o QR Code de novo a cada deploy/restart,
// desde que o volume de disco seja persistente no host escolhido (ver instruções de deploy).
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // Em container (Dockerfile fornecido), usa o Chromium já instalado no sistema em vez de baixar um novo
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
});

let clientReady = false;

client.on('qr', (qr) => {
  console.log('\n=== ESCANEIE ESTE QR CODE NO WHATSAPP DO NÚMERO DO BOT ===\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  clientReady = true;
  console.log('Bot conectado ao WhatsApp e pronto para enviar mensagens.');
});

client.on('disconnected', (reason) => {
  clientReady = false;
  console.error('Bot desconectado do WhatsApp:', reason);
});

client.initialize();

function checkAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (token !== API_TOKEN) {
    return res.status(401).json({ sucesso: false, erro: 'Token inválido.' });
  }
  next();
}

// Endpoint de verificação simples, útil para testar antes de plugar no Lovable
app.get('/status', (req, res) => {
  res.json({ conectado: clientReady });
});

// Endpoint principal — contrato já combinado no prompt do Lovable:
// POST /enviar  { "grupo": "Nome do Grupo", "mensagem": "texto..." }
app.post('/enviar', checkAuth, async (req, res) => {
  const { grupo, mensagem } = req.body || {};

  if (!grupo || !mensagem) {
    return res.status(400).json({ sucesso: false, erro: 'Campos "grupo" e "mensagem" são obrigatórios.' });
  }

  if (!clientReady) {
    return res.status(503).json({ sucesso: false, erro: 'Bot ainda não está conectado ao WhatsApp.' });
  }

  try {
    const chats = await client.getChats();
    const chatGrupo = chats.find(
      (c) => c.isGroup && c.name.trim().toLowerCase() === grupo.trim().toLowerCase()
    );

    if (!chatGrupo) {
      return res.status(404).json({
        sucesso: false,
        erro: `Grupo "${grupo}" não encontrado entre os chats do número do bot. Confirme o nome exato e se o número do bot participa desse grupo.`,
      });
    }

    await client.sendMessage(chatGrupo.id._serialized, mensagem);
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    return res.status(500).json({ sucesso: false, erro: String(err.message || err) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor do bot rodando na porta ${PORT}`);
});
