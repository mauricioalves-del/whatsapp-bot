const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

console.log('=== Iniciando server.js ===');

const app = express();
app.use(express.json());

const API_TOKEN = process.env.API_TOKEN;
const PORT = process.env.PORT || 3000;

if (!API_TOKEN) {
  console.error('ERRO: defina a variável de ambiente API_TOKEN antes de iniciar.');
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
});

let clientReady = false;
let lastQr = null;

client.on('qr', (qr) => {
  lastQr = qr;
  console.log('\n=== ESCANEIE ESTE QR CODE NO WHATSAPP DO NÚMERO DO BOT ===\n');
  console.log(`Ou abra no navegador: /qr?token=SEU_TOKEN\n`);
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  clientReady = true;
  lastQr = null;
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

app.get('/status', (req, res) => {
  res.json({ conectado: clientReady });
});

app.get('/qr', async (req, res) => {
  if (req.query.token !== API_TOKEN) {
    return res.status(401).send('Token inválido.');
  }
  if (clientReady) {
    return res.status(200).send('Bot já está conectado — não há QR Code pendente.');
  }
  if (!lastQr) {
    return res.status(404).send('QR Code ainda não gerado. Aguarde alguns segundos e recarregue a página.');
  }
  try {
    const png = await QRCode.toBuffer(lastQr, { type: 'png', width: 400, margin: 2 });
    res.type('png').send(png);
  } catch (err) {
    res.status(500).send('Erro ao gerar imagem do QR Code: ' + String(err.message || err));
  }
});

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
