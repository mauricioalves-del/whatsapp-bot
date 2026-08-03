# Guia de Deploy — Bot de WhatsApp (Selenium) em Servidor Real

Objetivo final: ter uma URL do tipo `https://whatsapp-bot.suaempresa.com.br/send-message` funcionando, para colar em `whatsapp_bot_url` no Lovable.

---

## Alternativa mais simples: rodar no seu próprio computador (sem VPS)

Se o roteiro completo (Passos 1-13 abaixo) parece complexo demais, existe um caminho bem mais curto: rodar o bot no **mesmo computador onde hoje roda a macro do Excel**, e usar um **túnel** (Cloudflare Tunnel ou ngrok) para expor esse bot na internet com HTTPS — sem VPS, sem Nginx, sem certificado manual.

**O que você ganha:** pula os Passos 1, 5 (Xvfb/x11vnc não são necessários — você tem tela normal no seu PC) e 11 (Nginx/certbot) inteiros. Basicamente só os Passos 3, 4, 6-10 e 12-13, mais a instalação do túnel.

**Como fazer (resumo — Cloudflare Tunnel, gratuito):**
```bash
# 1. Instalar o cloudflared no seu computador (Windows: baixar o .exe do site da Cloudflare;
#    Mac: brew install cloudflare/cloudflare/cloudflared; Linux: pacote .deb do site)

# 2. Rodar o bot normalmente na sua máquina (Passos 6-10 abaixo, sem Xvfb — HEADLESS=false já
#    abre uma janela do Chrome normal na sua tela, você escaneia o QR Code direto, sem VNC)
npm start

# 3. Em outro terminal, abrir o túnel apontando para a porta do bot
cloudflared tunnel --url http://localhost:3000
```
O `cloudflared` imprime uma URL pública do tipo `https://algo-aleatorio.trycloudflare.com` — é essa URL (+ `/send-message`) que vai em `whatsapp_bot_url` no Lovable. Já vem com HTTPS, sem você precisar configurar nada de certificado.

**O trade-off que você precisa aceitar nessa via:**
- O bot só funciona enquanto **esse computador estiver ligado, conectado à internet, e com o `npm start` e o `cloudflared` rodando**. Se o PC dormir, reiniciar, ou a janela do terminal fechar, a automação para.
- A URL gratuita do `trycloudflare.com` **muda toda vez que você reinicia o túnel** — se isso acontecer, precisa atualizar `whatsapp_bot_url` no Lovable de novo. (Dá para ter uma URL fixa configurando um domínio próprio no Cloudflare Tunnel, mas isso já reintroduz um pouco da complexidade de domínio que essa alternativa tenta evitar.)

Se seu computador de trabalho já fica ligado o dia todo mesmo (parece ser o caso, já que a macro do Excel roda nele), essa é provavelmente a via mais rápida para colocar no ar **hoje**, deixando a migração para VPS como um passo de "profissionalizar depois", não um bloqueio agora.

Se preferir seguir direto para o servidor de verdade (mais estável, não depende do seu PC estar ligado), o roteiro completo está abaixo.

---

## Passo 1 — Criar o servidor (VPS)

Você precisa de um servidor Linux sempre ligado. Sugestão simples e barata:

- **Hetzner Cloud** ou **DigitalOcean** — plano menor (1 vCPU, 2GB RAM já é suficiente), imagem **Ubuntu 22.04**.
- Ao criar, escolha um método de acesso SSH (chave SSH é mais seguro; senha também funciona para começar).
- Anote o **IP público** do servidor.

## Passo 2 — Conectar via SSH

No seu computador (Windows: use PowerShell ou PuTTY; Mac/Linux: Terminal):

```bash
ssh root@SEU_IP_PUBLICO
```

## Passo 3 — Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
node -v   # confirme que instalou (ex.: v20.x)
```

## Passo 4 — Instalar o Google Chrome

```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable
google-chrome --version   # confirme
```

## Passo 5 — Instalar dependências para rodar o Chrome num servidor sem tela

```bash
sudo apt-get install -y xvfb x11vnc libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1
```

- `xvfb` cria uma "tela virtual" no servidor.
- `x11vnc` permite você **ver essa tela virtual remotamente**, do seu computador — é assim que você vai escanear o QR Code na primeira vez, mesmo o servidor não tendo monitor físico.

## Passo 6 — Enviar os arquivos do bot para o servidor

No seu computador, dentro da pasta `whatsapp-bot-selenium` que te entreguei:

```bash
scp -r whatsapp-bot-selenium root@SEU_IP_PUBLICO:/root/
```

## Passo 7 — Instalar as dependências do bot

De volta no terminal SSH (conectado no servidor):

```bash
cd /root/whatsapp-bot-selenium
npm install
```

## Passo 8 — Configurar o .env

```bash
cp .env.example .env
nano .env
```

Gere um token forte antes de colar:
```bash
openssl rand -hex 32
```

Cole o resultado em `BOT_AUTH_TOKEN` dentro do `.env`. Mantenha `HEADLESS=false` por enquanto (precisa ver a tela para escanear o QR Code). Salve (`Ctrl+O`, Enter, `Ctrl+X` no nano).

## Passo 9 — Primeira execução: escanear o QR Code remotamente

Inicie a tela virtual e o visualizador remoto:

```bash
Xvfb :99 -screen 0 1280x800x24 &
export DISPLAY=:99
x11vnc -display :99 -nopw -forever &
```

Agora inicie o bot (ele vai abrir o Chrome dentro dessa tela virtual):

```bash
npm start
```

No **seu computador** (não no servidor), instale um visualizador VNC — ex.: [TigerVNC Viewer](https://tigervnc.org/) ou [RealVNC Viewer](https://www.realvnc.com/download/viewer/) — e conecte em:

```
SEU_IP_PUBLICO:5900
```

Você vai ver a tela do Chrome com o WhatsApp Web. Escaneie o QR Code com o **número dedicado da empresa** (celular → WhatsApp → Dispositivos conectados → Conectar dispositivo).

> ⚠️ Por segurança, o `x11vnc -nopw` acima não tem senha — só é aceitável porque você vai usar por poucos minutos, para esse login inicial. Depois de escanear, pare o `x11vnc` (`fg` para trazer ao primeiro plano e `Ctrl+C`, ou `pkill x11vnc`) e **não deixe essa porta aberta continuamente**. Se preferir, adicione firewall liberando a porta 5900 só para o seu IP, e feche depois de usar.

## Passo 10 — Confirmar que logou e deixar rodando em segundo plano

Depois de escanear, o terminal deve mostrar `WhatsApp Web pronto para enviar mensagens.`. A sessão fica salva em `whatsapp-session/` — não precisa escanear de novo, mesmo reiniciando o processo.

Pare o processo atual (`Ctrl+C`) e suba de forma definitiva com `pm2` (mantém rodando mesmo se cair, e reinicia junto com o servidor):

```bash
npm install -g pm2
DISPLAY=:99 pm2 start server.js --name whatsapp-bot
pm2 save
pm2 startup
```

> A tela virtual (`Xvfb`) também precisa continuar rodando sempre — o mais simples é deixar o comando `Xvfb :99 ... &` num script de inicialização do sistema (`/etc/rc.local` ou um serviço systemd), para subir junto com o servidor caso ele reinicie.

## Passo 11 — Colocar HTTPS na frente (obrigatório)

O bot roda na porta 3000 sem criptografia — não pode ficar exposto assim. Use Nginx como proxy com certificado grátis (Let's Encrypt):

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Aponte um subdomínio para o IP do servidor (no painel DNS do seu domínio, crie um registro tipo **A**: `whatsapp-bot.suaempresa.com.br` → `SEU_IP_PUBLICO`).

Crie a configuração do Nginx:
```bash
sudo nano /etc/nginx/sites-available/whatsapp-bot
```
Conteúdo:
```nginx
server {
    listen 80;
    server_name whatsapp-bot.suaempresa.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```
Ative e gere o certificado:
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d whatsapp-bot.suaempresa.com.br
```
O certbot já reconfigura o Nginx para HTTPS automaticamente e renova o certificado sozinho.

## Passo 12 — Testar de fora

Do seu computador (não precisa mais estar no SSH):

```bash
curl https://whatsapp-bot.suaempresa.com.br/health
# { "ready": true }
```

Teste o envio real:
```bash
curl -X POST https://whatsapp-bot.suaempresa.com.br/send-message \
  -H "Authorization: Bearer SEU_TOKEN_DO_ENV" \
  -H "Content-Type: application/json" \
  -d '{"groupName": "Mágio: Geral Todos", "message": "Teste do bot ✅"}'
```
Confirme que a mensagem chegou de fato no grupo.

## Passo 13 — Preencher no Lovable

Em Configurações → Integrações:
- `whatsapp_bot_url` → `https://whatsapp-bot.suaempresa.com.br/send-message`
- `whatsapp_bot_token` → o mesmo valor do `BOT_AUTH_TOKEN` no `.env`
- `whatsapp_grupo_nome` → `Mágio: Geral Todos` (nome exato do grupo)

Gere uma ação de Desconto Colaborador de teste e confirme que chega no grupo.

---

## Se algo der errado

- **`/health` retorna `ready: false` depois de um tempo**: a sessão do WhatsApp caiu. Repita o Passo 9 (Xvfb + VNC) para escanear o QR Code de novo.
- **Erro 401 no `curl`**: token errado — confira se o `.env` do servidor e o valor colado no Lovable são exatamente o mesmo.
- **O bot não acha o grupo**: confirme que `groupName` está **idêntico** ao nome exibido no WhatsApp (acentos, dois pontos, espaços — tudo importa, porque a busca no `server.js` compara o texto exato).
