// Google Apps Script (backend)
// Publica como Web App e use a URL no script.js do GitHub Pages.
//
// Estrutura esperada:
// - cadastro: CPF | Nome | DataNascimento | Email | WhatsApp | Bairro | DataCadastro
// - eventos: CPF | Nome | Bairro | Evento | DataConfirmacao
//
// IMPORTANTE:
// O bot do Telegram e o acesso ao Spreadsheet ficam aqui, no backend.
// Não coloque o token do Telegram no GitHub Pages.

const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
const TELEGRAM_BOT_TOKEN = 'COLE_SEU_TOKEN_AQUI';
const TELEGRAM_CHAT_ID = 'COLE_SEU_CHAT_ID_AQUI';

const CADASTRO_SHEET_NAME = 'cadastro';
const EVENTOS_SHEET_NAME = 'eventos';

const CADASTRO_HEADERS = [
  'CPF',
  'Nome',
  'DataNascimento',
  'Email',
  'WhatsApp',
  'Bairro',
  'DataCadastro'
];

const EVENTOS_HEADERS = [
  'CPF',
  'Nome',
  'Bairro',
  'Evento',
  'DataConfirmacao'
];

function doGet(e) {
  const action = String(e?.parameter?.action || '').toLowerCase();

  if (action === 'consultar') {
    const cpf = e?.parameter?.cpf || '';
    return json_(consultarCpf_(cpf));
  }

  if (action === 'eventos') {
    return json_(listarEventos_());
  }

  return json_({
    ok: false,
    message: 'Ação inválida.'
  });
}

function doPost(e) {
  const p = e?.parameter || {};
  const action = String(p.action || '').toLowerCase();

  try {
    if (action === 'salvarcadastro') {
      const resultado = salvarCadastro_({
        cpf: p.cpf,
        nome: p.nome,
        dataNascimento: p.dataNascimento,
        email: p.email,
        whatsapp: p.whatsapp,
        bairro: p.bairro
      });
      return json_(resultado);
    }

    if (action === 'salvarpresenca') {
      const resultado = salvarPresenca_({
        cpf: p.cpf,
        nome: p.nome,
        bairro: p.bairro,
        evento: p.evento,
        presenca: p.presenca
      });
      return json_(resultado);
    }

    return json_({
      ok: false,
      message: 'Ação inválida.'
    });
  } catch (err) {
    return json_({
      ok: false,
      message: err.message || String(err)
    });
  }
}

function consultarCpf_(cpf) {
  const cpfNormalizado = corrigirCpfBusca_(cpf);

  if (!cpfNormalizado || cpfNormalizado.length !== 11) {
    return {
      ok: true,
      encontrado: false,
      message: 'CPF inválido.'
    };
  }

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const abaCadastro = getOrCreateSheet_(planilha, CADASTRO_SHEET_NAME, CADASTRO_HEADERS);
  const dados = abaCadastro.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    const cpfPlanilha = corrigirCpfBusca_(dados[i][0]);
    if (cpfPlanilha === cpfNormalizado) {
      return {
        ok: true,
        encontrado: true,
        cadastro: {
          cpf: cpfNormalizado,
          nome: String(dados[i][1] || '').trim(),
          dataNascimento: String(dados[i][2] || '').trim(),
          email: String(dados[i][3] || '').trim(),
          whatsapp: String(dados[i][4] || '').trim(),
          bairro: String(dados[i][5] || '').trim(),
          dataCadastro: String(dados[i][6] || '').trim(),
        },
        eventosDisponiveis: listarNomesDeEventos_(planilha),
      };
    }
  }

  return {
    ok: true,
    encontrado: false,
    eventosDisponiveis: listarNomesDeEventos_(planilha),
    message: 'CPF não encontrado.'
  };
}

function salvarCadastro_(dados) {
  if (!dados) {
    throw new Error('Dados do cadastro não informados.');
  }

  const cpf = normalizarCpf_(dados.cpf);
  const nome = String(dados.nome || '').trim();
  const dataNascimento = String(dados.dataNascimento || '').trim();
  const email = String(dados.email || '').trim();
  const whatsapp = String(dados.whatsapp || '').trim();
  const bairro = String(dados.bairro || '').trim();

  if (!cpf) throw new Error('CPF inválido.');
  if (!nome) throw new Error('Informe o nome.');
  if (!dataNascimento) throw new Error('Informe a data de nascimento.');
  if (!whatsapp) throw new Error('Informe o WhatsApp.');
  if (!bairro) throw new Error('Selecione o bairro.');

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const abaCadastro = getOrCreateSheet_(planilha, CADASTRO_SHEET_NAME, CADASTRO_HEADERS);

  const existente = lookupCpfData_(cpf);
  if (existente.encontrado) {
    throw new Error('Este CPF já está cadastrado.');
  }

  const linha = abaCadastro.getLastRow() + 1;
  abaCadastro.getRange(linha, 1, 1, 7).setValues([[
    cpf,
    nome,
    dataNascimento,
    email,
    whatsapp,
    bairro,
    new Date()
  ]]);

  abaCadastro.getRange(linha, 1).setNumberFormat('@');

  sendTelegram_(
    '🆕 NOVO CADASTRO\n\n' +
    '👤 Nome: ' + nome + '\n' +
    '📍 Bairro: ' + bairro + '\n' +
    '📱 WhatsApp: ' + whatsapp + '\n' +
    '🪪 CPF: ' + cpf
  );

  SpreadsheetApp.flush();

  return {
    ok: true,
    sucesso: true,
    message: 'Cadastro realizado com sucesso!'
  };
}

function salvarPresenca_(dados) {
  if (!dados) {
    throw new Error('Dados da presença não informados.');
  }

  const cpf = normalizarCpf_(dados.cpf);
  const nomeInformado = String(dados.nome || '').trim();
  const bairroInformado = String(dados.bairro || '').trim();
  const evento = String(dados.evento || '').trim();
  const presenca = String(dados.presenca || '').trim().toLowerCase();

  if (!cpf) throw new Error('CPF inválido.');
  if (!evento) throw new Error('Informe o nome do evento.');

  const cadastro = lookupCpfData_(cpf);
  if (!cadastro.encontrado) {
    throw new Error('CPF não encontrado no cadastro.');
  }

  const nome = nomeInformado || cadastro.nome;
  const bairro = bairroInformado || cadastro.bairro;

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const abaEventos = getOrCreateSheet_(planilha, EVENTOS_SHEET_NAME, EVENTOS_HEADERS);

  const linha = abaEventos.getLastRow() + 1;
  abaEventos.getRange(linha, 1, 1, 5).setValues([[
    cpf,
    nome,
    bairro,
    evento,
    new Date()
  ]]);

  abaEventos.getRange(linha, 1).setNumberFormat('@');

  sendTelegram_(
    '🎉 PRESENÇA CONFIRMADA\n\n' +
    '👤 Nome: ' + nome + '\n' +
    '📍 Bairro: ' + bairro + '\n' +
    '📍 Evento: ' + evento + '\n' +
    '🪪 CPF: ' + cpf
  );

  SpreadsheetApp.flush();

  return {
    ok: true,
    sucesso: true,
    message: 'Presença confirmada com sucesso!'
  };
}

function getOrCreateSheet_(planilha, nome, headers) {
  let sheet = planilha.getSheetByName(nome);

  if (!sheet) {
    sheet = planilha.insertSheet(nome);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const primeiraLinha = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const vazio = primeiraLinha.every((cell) => String(cell || '').trim() === '');

  if (vazio) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function lookupCpfData_(cpf) {
  const cpfNormalizado = normalizarCpf_(cpf);
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const aba = getOrCreateSheet_(planilha, CADASTRO_SHEET_NAME, CADASTRO_HEADERS);
  const dados = aba.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    const cpfPlanilha = normalizarCpf_(dados[i][0]);
    if (cpfPlanilha === cpfNormalizado) {
      return {
        encontrado: true,
        nome: String(dados[i][1] || '').trim(),
        bairro: String(dados[i][5] || '').trim(),
      };
    }
  }

  return { encontrado: false };
}

function listarNomesDeEventos_(planilha) {
  const abaEventos = getOrCreateSheet_(planilha, EVENTOS_SHEET_NAME, EVENTOS_HEADERS);
  const dados = abaEventos.getDataRange().getValues();
  const nomes = [];

  for (let i = 1; i < dados.length; i++) {
    const evento = String(dados[i][3] || '').trim();
    if (evento) nomes.push(evento);
  }

  return [...new Set(nomes)];
}

function corrigirCpfBusca_(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');

  // Se vier com 10 dígitos, completa com zero à esquerda.
  if (cpf.length === 10) {
    cpf = '0' + cpf;
  }

  return cpf;
}

function normalizarCpf_(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .padStart(11, '0')
    .slice(-11);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendTelegram_(text) {
  if (
    !TELEGRAM_BOT_TOKEN ||
    !TELEGRAM_CHAT_ID ||
    String(TELEGRAM_BOT_TOKEN).includes('COLE_SEU_TOKEN_AQUI') ||
    String(TELEGRAM_CHAT_ID).includes('COLE_SEU_CHAT_ID_AQUI')
  ) {
    return;
  }

  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
