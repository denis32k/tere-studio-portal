# Terê Studio — Portal de Prévia Mobile

Site/PWA pra lojista gerar prévia de produto pelo celular, de qualquer lugar (sem precisar estar na rede Wi-Fi da loja). Login com e-mail/CPF já cadastrados na licença, catálogo sincronizado do PC principal, prévia enviada por WhatsApp.

Não contém banco de dados próprio — todo o backend (login, catálogo) vive dentro do `tere-license-server` (rotas `/portal/*`). Este app aqui é só o front-end estático + um servidor Node mínimo pra servi-lo.

## EasyPanel

Crie um App separado para este pacote (fonte: este repositório Git).

- Domínio: `minhaloja.terepersonalizados.com.br`
- Porta interna: `8080`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Sem volume persistente (não guarda dado nenhum, é só arquivo estático)

## Variáveis de ambiente

Copie o conteúdo de `.env.easypanel.example` para as variáveis do app no EasyPanel. A mais importante é `VITE_LICENSE_SERVER_URL` — precisa apontar pro `tere-license-server` de produção (`https://li.terepersonalizados.com.br/api`). Como é lida em tempo de BUILD (não runtime), se precisar trocar depois é preciso rodar o build de novo (redeploy), reiniciar sozinho não basta.

## Pré-requisito no tere-license-server

Este portal só funciona se o `tere-license-server` de produção já tiver as rotas `/portal/*` (login, catálogo) — foram adicionadas em 17/07/2026 e ainda não tinham sido deployadas até este ponto. Confirme rodando `https://li.terepersonalizados.com.br/api/portal/logout` (POST) — se responder `{"ok":true}` em vez de 404, a rota existe.

## Testes depois do deploy

- `https://minhaloja.terepersonalizados.com.br/` → deve carregar a tela de login.
- `https://minhaloja.terepersonalizados.com.br/manifest.webmanifest` → deve responder um JSON.
- Testar o fluxo completo com uma loja de plano profissional ou superior (o recurso é bloqueado nos planos abaixo disso).
