# Bot WhatsApp — Colaboradores

Serviço separado (fora do Lovable) que mantém uma sessão do WhatsApp Web logada e expõe um endpoint HTTP para postar no grupo de colaboradores. Este README responde diretamente aos 3 campos da tela "WhatsApp — Colaboradores" do Lovable.

---

## Passo 1 — Escolher onde hospedar

Precisa de um host que rode um **processo Node contínuo** (não serverless) e, de preferência, com **disco persistente** (para não perder a sessão logada a cada restart). Sugestão mais simples: **Railway** (tem free tier, suporta Docker, tem volume persistente).

1. Crie uma conta em https://railway.app
2. "New Project" → "Deploy from GitHub repo" (suba esta pasta para um repositório no seu GitHub) — ou "Empty Project" e depois conectar via CLI/Docker.
3. Em **Variables**, adicione:
   - `API_TOKEN` = uma senha longa e aleatória que **você mesmo cria agora** (ex.: gere uma em https://www.uuidgenerator.net ou rode `openssl rand -hex 32` no seu terminal). Guarde esse valor — é o mesmo que vai no campo **"Token (Bearer)"** do Lovable.
4. Em **Settings → Volumes**, adicione um volume persistente montado em `/app/session` (é onde a sessão logada do WhatsApp fica salva — sem isso, você teria que escanear o QR Code de novo a cada deploy).
5. Deploy.

## Passo 2 — Logar o número do bot no WhatsApp

1. Depois do deploy, abra a aba de **Logs** do Railway.
2. Vai aparecer um QR Code em ASCII no terminal de logs.
3. No celular que será o **número do bot** (recomendado: um número dedicado da empresa — WhatsApp Business, não o número pessoal de ninguém), abra WhatsApp → Configurações → Aparelhos Conectados → Conectar um aparelho → escaneie o QR Code que apareceu nos logs.
4. Quando aparecer nos logs `Bot conectado ao WhatsApp e pronto para enviar mensagens.`, está pronto.
5. Adicione esse número do bot **como participante do grupo "Colaboradores"** no WhatsApp (ele precisa estar no grupo para conseguir postar nele).

## Passo 3 — Preencher os 3 campos no Lovable

Depois do deploy, o Railway te dá uma URL pública (algo como `https://whatsapp-bot-colaboradores.up.railway.app`).

| Campo no Lovable | O que colocar |
|---|---|
| **URL do bot** | `https://{sua-url-do-railway}/enviar` — com `/enviar` no final, é a rota que o server.js expõe |
| **Token (Bearer)** | o mesmo valor que você colocou em `API_TOKEN` no Passo 1 |
| **Nome do grupo** | o nome **exato** do grupo, igual está salvo no WhatsApp do número do bot (ex.: `Colaboradores`) — a busca ignora maiúsculas/minúsculas e espaços nas pontas, mas o nome em si precisa ser igual |

Clique **Salvar**.

## Passo 4 — Testar antes de confiar

Antes de gerar uma ação de verdade no Lovable, teste o bot isolado:

```bash
curl -X POST https://{sua-url-do-railway}/enviar \
  -H "Authorization: Bearer {seu-token}" \
  -H "Content-Type: application/json" \
  -d '{"grupo": "Colaboradores", "mensagem": "Teste do bot 🍫"}'
```

Se voltar `{"sucesso": true}` e a mensagem aparecer no grupo, está tudo certo — pode gerar uma ação de Desconto Colaborador de verdade no Lovable para validar o ciclo completo.

Para checar rapidamente se o bot está conectado sem enviar nada:
```bash
curl https://{sua-url-do-railway}/status
```

---

## Avisos importantes

- **Use um número dedicado**, nunca o WhatsApp pessoal de alguém — em caso de bloqueio pelo WhatsApp (risco real de automação não-oficial), o impacto fica isolado.
- Se o bot cair (`sucesso: false` ou timeout), o Lovable já foi configurado para **não bloquear a criação da ação** — só registra o erro em auditoria. Vale checar `/status` periodicamente.
- Se algum dia migrar para a API oficial (Meta Cloud API/Twilio), o contrato HTTP (`POST /enviar` com `grupo`/`mensagem`) muda para envio por lista de números — o lado do Lovable precisaria de um pequeno ajuste, mas a estrutura de configuração (URL + Token) continua a mesma ideia.
