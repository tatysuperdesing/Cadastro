// Frontend GitHub Pages para consulta de CPF + Google Sheets via Apps Script.
// Mantém a lógica do cadastro, confirmação de presença e envio ao Telegram no backend.

// 1) Cole aqui a URL do Web App do Google Apps Script (deploy como "Acesso: qualquer pessoa").
// Exemplo: https://script.google.com/macros/s/SEU_ID/exec
const APPS_SCRIPT_URL = 'COLE_AQUI_A_URL_DO_WEB_APP_DO_APPS_SCRIPT';

const form = document.getElementById('mainForm');
const cpfInput = document.getElementById('cpf');
const cpfHelp = document.getElementById('cpfHelp');
const cpfStatus = document.getElementById('cpfStatus');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');

const cadastroSection = document.getElementById('cadastroSection');
const cadastroResumo = document.getElementById('cadastroResumo');
const nomeEncontrado = document.getElementById('nomeEncontrado');
const bairroEncontrado = document.getElementById('bairroEncontrado');

const presencaSection = document.getElementById('presencaSection');
const presencaConfirmada = document.getElementById('presencaConfirmada');
const eventoSelect = document.getElementById('eventoSelect');
const eventoManual = document.getElementById('eventoManual');
const eventoHelp = document.getElementById('eventoHelp');

const novoCadastroSection = document.getElementById('novoCadastroSection');
const cpfNovo = document.getElementById('cpfNovo');
const nomeCompleto = document.getElementById('nomeCompleto');
const dataNascimento = document.getElementById('dataNascimento');
const bairroInput = document.getElementById('bairro');
const whatsappInput = document.getElementById('whatsapp');

const feedback = document.getElementById('feedback');

const state = {
  status: 'idle', // idle | typing | invalid | not_found | found | new | saving | success | error
  cpfDigits: '',
  lookupTimer: null,
  lookupAbort: null,
  foundData: null,
  eventosDisponiveis: [],
  lastLookupCpf: '',
};

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  let result = '';
  if (parts[0]) result += parts[0];
  if (parts[1]) result += '.' + parts[1];
  if (parts[2]) result += '.' + parts[2];
  if (digits.length > 9) result += '-' + digits.slice(9, 11);
  return result;
}

function normalizeCpf(value) {
  return onlyDigits(value).padStart(11, '0').slice(-11);
}

function isRepeatedDigits(cpf) {
  return /^([0-9])\1{10}$/.test(cpf);
}

function isValidCpf(cpf) {
  cpf = onlyDigits(cpf);

  if (cpf.length !== 11) return false;
  if (isRepeatedDigits(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;

  return rest === Number(cpf[10]);
}

function setStatus(type, message) {
  cpfStatus.innerHTML = '';
  if (!message) return;
  const box = document.createElement('div');
  box.className = `status-box show ${type}`;
  box.textContent = message;
  cpfStatus.appendChild(box);
}

function setFeedback(type, message) {
  feedback.className = `feedback show ${type}`;
  feedback.textContent = message;
}

function clearFeedback() {
  feedback.className = 'feedback';
  feedback.textContent = '';
  feedback.textContent = '';
}

function setCpfVisualState(mode) {
  cpfInput.classList.remove('invalid', 'valid');
  if (mode === 'invalid' || mode === 'not_found') cpfInput.classList.add('invalid');
  if (mode === 'found' || mode === 'new') cpfInput.classList.add('valid');
}

function hideAllPanels() {
  cadastroSection.classList.add('hidden');
  presencaSection.classList.add('hidden');
  novoCadastroSection.classList.add('hidden');
}

function resetCadastroFields() {
  nomeCompleto.value = '';
  dataNascimento.value = '';
  bairroInput.value = '';
  whatsappInput.value = '';
}

function resetPresenceFields() {
  eventoSelect.innerHTML = '';
  eventoSelect.classList.add('hidden');
  eventoManual.value = '';
  eventoManual.classList.add('hidden');
  eventoHelp.textContent = '';
  presencaConfirmada.checked = true;
}

function prepareNewCadastro(cpfFormatted) {
  hideAllPanels();
  resetPresenceFields();

  novoCadastroSection.classList.remove('hidden');
  cpfNovo.value = cpfFormatted;

  setStatus('warn', 'CPF não encontrado. Preencha o cadastro para continuar.');
  setCpfVisualState('not_found');
  state.status = 'new';
  submitBtn.disabled = false;
}

function prepareFoundCadastro(data) {
  hideAllPanels();
  cadastroSection.classList.remove('hidden');
  presencaSection.classList.remove('hidden');

  nomeEncontrado.textContent = data?.nome || '-';
  bairroEncontrado.textContent = data?.bairro || '-';
  cadastroResumo.textContent = data?.cpf ? `CPF ${formatCpf(data.cpf)} encontrado no cadastro.` : 'Cadastro encontrado.';

  const eventos = Array.isArray(data?.eventosDisponiveis) ? data.eventosDisponiveis : [];
  resetPresenceFields();

  if (eventos.length > 0) {
    eventoSelect.classList.remove('hidden');
    eventoSelect.innerHTML = `<option value="">Selecione um evento</option>` + eventos
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join('');
    eventoHelp.textContent = 'Escolha um evento da lista.';
  } else {
    eventoManual.classList.remove('hidden');
    eventoHelp.textContent = 'Nenhum evento disponível foi retornado. Digite o nome do evento manualmente.';
  }

  setStatus('ok', 'CPF válido e cadastro localizado.');
  setCpfVisualState('found');
  state.status = 'found';
  submitBtn.disabled = false;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function apiGet(params) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }
  return data;
}

async function apiPost(params) {
  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: formData,
    mode: 'cors',
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }
  return data;
}

async function lookupCpf(cpfDigits) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('COLE_AQUI')) {
    setStatus('error', 'Cole a URL do Web App do Apps Script no script.js.');
    setCpfVisualState('invalid');
    return;
  }

  if (state.lookupAbort) {
    state.lookupAbort.abort();
  }
  state.lookupAbort = new AbortController();

  state.status = 'typing';
  setStatus('info', 'Consultando cadastro...');
  submitBtn.disabled = true;

  try {
    const data = await apiGet({
      action: 'consultar',
      cpf: cpfDigits,
    });

    if (data?.ok && data.encontrado) {
      state.foundData = data.cadastro || null;
      state.eventosDisponiveis = Array.isArray(data.eventosDisponiveis) ? data.eventosDisponiveis : [];
      state.lastLookupCpf = cpfDigits;
      prepareFoundCadastro({
        cpf: cpfDigits,
        nome: data.cadastro?.nome || '',
        bairro: data.cadastro?.bairro || '',
        eventosDisponiveis: state.eventosDisponiveis,
      });
      return;
    }

    state.foundData = null;
    state.eventosDisponiveis = [];
    state.lastLookupCpf = cpfDigits;
    prepareNewCadastro(formatCpf(cpfDigits));
  } catch (error) {
    console.error(error);
    setStatus('error', error.message || 'Erro ao consultar o CPF.');
    setCpfVisualState('invalid');
    submitBtn.disabled = true;
  } finally {
    state.lookupAbort = null;
  }
}

function scheduleLookup() {
  window.clearTimeout(state.lookupTimer);
  const digits = onlyDigits(cpfInput.value).slice(0, 11);

  state.cpfDigits = digits;
  cpfInput.value = formatCpf(digits);

  if (digits.length === 0) {
    hideAllPanels();
    resetPresenceFields();
    resetCadastroFields();
    setStatus('info', 'Digite o CPF para iniciar a consulta.');
    cpfInput.classList.remove('invalid', 'valid');
    submitBtn.disabled = true;
    state.status = 'idle';
    return;
  }

  if (digits.length < 11) {
    hideAllPanels();
    resetPresenceFields();
    setStatus('info', 'Digite os 11 dígitos do CPF.');
    cpfInput.classList.remove('invalid', 'valid');
    submitBtn.disabled = true;
    state.status = 'typing';
    return;
  }

  if (!isValidCpf(digits)) {
    hideAllPanels();
    resetPresenceFields();
    setStatus('error', 'CPF inválido. Verifique os dígitos informados.');
    setCpfVisualState('invalid');
    submitBtn.disabled = true;
    state.status = 'invalid';
    return;
  }

  setCpfVisualState('found');
  setStatus('info', 'CPF válido. Verificando no cadastro...');
  submitBtn.disabled = true;
  state.status = 'typing';

  state.lookupTimer = window.setTimeout(() => {
    lookupCpf(digits);
  }, 350);
}

function getSelectedEvent() {
  if (!eventoSelect.classList.contains('hidden')) {
    return eventoSelect.value.trim();
  }
  return eventoManual.value.trim();
}

function validatePresencePayload() {
  const evento = getSelectedEvent();
  if (presencaConfirmada.checked && !evento) {
    return 'Informe ou selecione um evento.';
  }
  return '';
}

function validateNewCadastro() {
  if (!nomeCompleto.value.trim()) return 'Informe o nome completo.';
  if (!dataNascimento.value) return 'Informe a data de nascimento.';
  if (!bairroInput.value.trim()) return 'Informe o bairro.';
  if (!onlyDigits(whatsappInput.value).length) return 'Informe o WhatsApp.';
  return '';
}

function validateBeforeSubmit() {
  const cpf = normalizeCpf(cpfInput.value);
  if (!isValidCpf(cpf)) return 'CPF inválido.';
  if (state.status === 'new') return validateNewCadastro();
  if (state.status === 'found') return validatePresencePayload();
  return 'Digite um CPF válido primeiro.';
}

async function submitNewCadastro() {
  const cpf = normalizeCpf(cpfInput.value);
  const payload = {
    action: 'salvarCadastro',
    cpf,
    nome: nomeCompleto.value.trim(),
    dataNascimento: dataNascimento.value,
    email: '',
    whatsapp: onlyDigits(whatsappInput.value),
    bairro: bairroInput.value.trim(),
  };

  const result = await apiPost(payload);
  return result;
}

async function submitPresence() {
  const cpf = normalizeCpf(cpfInput.value);
  const nome = (state.foundData?.nome || nomeEncontrado.textContent || '').trim();
  const bairro = (state.foundData?.bairro || bairroEncontrado.textContent || '').trim();
  const evento = getSelectedEvent();

  const payload = {
    action: 'salvarPresenca',
    cpf,
    nome,
    bairro,
    evento,
    presenca: presencaConfirmada.checked ? 'sim' : 'nao',
  };

  const result = await apiPost(payload);
  return result;
}

function showSuccess(message) {
  setFeedback('success', message);
  setStatus('ok', message);
}

function showError(message) {
  setFeedback('error', message);
  setStatus('error', message);
}

cpfInput.addEventListener('input', scheduleLookup);

cpfInput.addEventListener('blur', () => {
  const digits = onlyDigits(cpfInput.value);
  cpfInput.value = formatCpf(digits);
});

whatsappInput.addEventListener('input', () => {
  const digits = onlyDigits(whatsappInput.value).slice(0, 11);
  if (digits.length <= 10) {
    whatsappInput.value = digits.replace(/(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, d1, d2, d3) => {
      let result = '';
      if (d1) result += `(${d1}`;
      if (d1.length === 2) result += ') ';
      if (d2) result += d2;
      if (d2.length === 5 && d3) result += '-';
      if (d3) result += d3;
      return result;
    });
  } else {
    whatsappInput.value = digits;
  }
});

clearBtn.addEventListener('click', () => {
  form.reset();
  cpfInput.value = '';
  cpfNovo.value = '';
  hideAllPanels();
  resetPresenceFields();
  resetCadastroFields();
  clearFeedback();
  cpfStatus.innerHTML = '';
  cpfInput.classList.remove('invalid', 'valid');
  submitBtn.disabled = true;
  state.status = 'idle';
  setStatus('info', 'Digite o CPF para iniciar a consulta.');
  cpfInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFeedback();

  const validationError = validateBeforeSubmit();
  if (validationError) {
    showError(validationError);
    return;
  }

  submitBtn.disabled = true;
  setStatus('info', 'Enviando...');

  try {
    if (state.status === 'new') {
      const result = await submitNewCadastro();
      showSuccess(result?.message || 'Cadastro enviado com sucesso.');
      state.status = 'success';
      submitBtn.disabled = false;
      return;
    }

    if (state.status === 'found') {
      const result = await submitPresence();
      showSuccess(result?.message || 'Presença confirmada com sucesso.');
      state.status = 'success';
      submitBtn.disabled = false;
      return;
    }

    showError('Não foi possível identificar a ação.');
  } catch (error) {
    console.error(error);
    showError(error.message || 'Erro ao enviar os dados.');
  } finally {
    if (state.status !== 'success') {
      submitBtn.disabled = false;
    }
  }
});

setStatus('info', 'Digite o CPF para iniciar a consulta.');
