# GitHub Pages + Google Sheets + Apps Script

## Como funciona
- O `index.html`, `style.css` e `script.js` ficam no GitHub Pages.
- O Google Apps Script fica como backend e acessa a planilha.
- O envio para o Telegram também acontece no Apps Script, não no front-end.

## O que você precisa trocar
1. Em `script.js`, coloque a URL do Web App do Apps Script em `APPS_SCRIPT_URL`.
2. Em `backend.gs`, coloque o `SPREADSHEET_ID`.
3. Em `backend.gs`, coloque o `TELEGRAM_BOT_TOKEN` e o `TELEGRAM_CHAT_ID`.
4. Publique o Apps Script como **Web App** com acesso liberado.

## Estrutura da planilha
Aba `cadastro`:
CPF | Nome | DataNascimento | Email | WhatsApp | Bairro | DataCadastro

Aba `eventos`:
CPF | Nome | Bairro | Evento | DataConfirmacao

## Observação importante
Não coloque o token do Telegram no GitHub Pages. Mantenha isso apenas no Apps Script.
