// JR TELECOM CAMAÇARI
// Site estático para GitHub Pages com envio ao Telegram.

const BASE_NAME = 'CAMAÇARI';
const SECTION_TITLE = '—> PEDIDO DE ESTOQUE <—';
const MESSAGE_TITLE = '🚨 Nova Solicitação 🚨';

// Mantidas no código, como solicitado.
const TELEGRAM_BOT_TOKEN = '8675551330:AAH5G9TcjqoI-rjvCr-QBAlQ4Wsxkolu9hY';
const TELEGRAM_CHAT_ID = '-1003549071393';

const MATERIALS = [
  {
    id: 'conectores-apc',
    name: 'Conectores SC/APC',
    unitLabel: 'Unidades',
    type: 'select',
    options: [10, 20, 30],
  },
  {
    id: 'drop-fibra',
    name: 'Drop Fibra',
    unitLabel: 'Metros',
    type: 'select',
    options: [1000, 2000],
  },
  {
    id: 'bucha-parafuso',
    name: 'Bucha & Parafuso',
    unitLabel: 'Unidades',
    type: 'select',
    options: [50, 100],
  },
  {
    id: 'fixa-fio',
    name: 'Fixa Fio',
    unitLabel: 'Unidades',
    type: 'select',
    options: [100, 200],
  },
    {
    id: 'abracadeira',
    name: 'Abraçadeira',
    unitLabel: 'Unidades',
    type: 'select',
    options: [100, 200],
  },
  {
    id: 'esticadores',
    name: 'Esticadores',
    unitLabel: 'Unidades',
    type: 'select',
    options: [50, 100],
  },
  {
    id: 'etiqueta-lacre',
    name: 'Etiqueta Lacre',
    unitLabel: 'Cartela (69 etiquetas)',
    type: 'select',
    options: [1, 2],
  },
  {
    id: 'espiral',
    name: 'Espiral',
    unitLabel: 'Metros',
    type: 'select',
    options: [1, 2],
  },
  {
    id: 'placas-jr',
    name: 'Placas JR',
    unitLabel: 'Unidades',
    type: 'select',
    options: [10, 20, 30],
  },
  {
    id: 'fita-isolante',
    name: 'Fita Isolante',
    unitLabel: 'Unidade',
    type: 'select',
    options: [1],
  },
  {
    id: 'fita-crepe',
    name: 'Fita Crepe',
    unitLabel: 'Unidade',
    type: 'select',
    options: [1],
  },
  {
    id: 'bucha-acabamento',
    name: 'Bucha de Acabamento',
    unitLabel: 'Unidades',
    type: 'select',
    options: [5, 10, 15],
  },
];

const form = document.getElementById('requestForm');
const technicianInput = document.getElementById('technicianName');
const feedbackEl = document.getElementById('feedback');
const materialsListEl = document.getElementById('materialsList');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(date = new Date()) {
  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function escapeFilename(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'solicitacao';
}

function formatQuantity(value, material) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString('pt-BR') : value;

  if (material.id === 'etiqueta-lacre') {
    return value === 1 ? '1 cartela (69 etiquetas)' : `${formattedValue} cartelas (138 etiquetas)`;
  }

  if (material.id === 'drop-fibra' || material.id === 'espiral') {
    return `${formattedValue} ${material.unitLabel}`;
  }

  return `${formattedValue} ${material.unitLabel}`;
}

function showFeedback(type, message) {
  feedbackEl.className = `feedback show ${type}`;
  feedbackEl.textContent = message;
}

function clearFeedback() {
  feedbackEl.className = 'feedback';
  feedbackEl.textContent = '';
}

function formatOptionLabel(material, option) {
  if (material.id === 'drop-fibra') {
    return `${option.toLocaleString('pt-BR')} metros`;
  }

  if (material.id === 'etiqueta-lacre') {
    return `${option} cartela${option > 1 ? 's' : ''} (69 cada)`;
  }

  if (material.id === 'espiral') {
    return `${option} metro${option > 1 ? 's' : ''}`;
  }

  return `${option} ${material.unitLabel.toLowerCase()}`;
}

function createMaterialCard(material) {
  const article = document.createElement('article');
  article.className = 'material-item';
  article.dataset.materialId = material.id;

  const helper = material.type === 'number'
    ? `Limite: de ${material.min} até ${material.max}`
    : `Opções: ${material.options.map((value) => formatOptionLabel(material, value)).join(', ')}`;

  const control = material.type === 'number'
    ? `
      <input
        type="number"
        min="${material.min}"
        max="${material.max}"
        step="${material.step || 1}"
        value=""
        id="${material.id}-qty"
        class="qty-input"
        inputmode="numeric"
        aria-label="Quantidade de ${material.name}"
        placeholder="0"
      />
    `
    : `
      <select id="${material.id}-qty" class="qty-input" aria-label="Quantidade de ${material.name}">
        <option value="">&lt;Selecione&gt;</option>
        ${material.options.map((option) => `<option value="${option}">${formatOptionLabel(material, option)}</option>`).join('')}
      </select>
    `;

  article.innerHTML = `
    <div class="material-top">
      <input type="checkbox" id="${material.id}" class="material-check" aria-label="Selecionar ${material.name}" />
      <div class="material-label">
        <label for="${material.id}" class="material-name">${material.name}</label>
        <div class="material-desc">${helper}</div>
      </div>
    </div>
    <div class="qty-wrap">
      <label for="${material.id}-qty">Quantidade</label>
      ${control}
    </div>
  `;

  const checkbox = article.querySelector('.material-check');
  const qtyWrap = article.querySelector('.qty-wrap');
  const qtyInput = article.querySelector('.qty-input');

  const syncSelection = () => {
    article.classList.toggle('selected', checkbox.checked);
    qtyWrap.style.display = checkbox.checked ? 'grid' : 'none';

    if (checkbox.checked) {
      if (material.type === 'select' && qtyInput.value === '') {
        qtyInput.selectedIndex = 0;
      }
      if (material.type === 'number' && qtyInput.value !== '' && Number(qtyInput.value) < material.min) {
        qtyInput.value = material.min;
      }
    }
  };

  checkbox.addEventListener('change', syncSelection);

  if (material.type === 'number') {
    qtyInput.addEventListener('input', () => {
      if (qtyInput.value === '') return;
      const value = Number(qtyInput.value);
      if (!Number.isInteger(value) || value < material.min) qtyInput.value = material.min;
      if (value > material.max) qtyInput.value = material.max;
    });
  }

  syncSelection();
  return article;
}

function renderMaterials() {
  materialsListEl.innerHTML = '';
  MATERIALS.forEach((material) => {
    materialsListEl.appendChild(createMaterialCard(material));
  });
}

function getSelectedMaterials() {
  const selected = [];
  document.querySelectorAll('.material-item').forEach((item) => {
    const checkbox = item.querySelector('.material-check');
    const qtyInput = item.querySelector('.qty-input');
    const material = MATERIALS.find((entry) => entry.id === item.dataset.materialId);

    if (!checkbox.checked || !material) return;

    let quantity = null;
    if (material.type === 'select') {
      quantity = qtyInput.value === '' ? null : Number(qtyInput.value);
    } else {
      quantity = qtyInput.value === '' ? null : Number(qtyInput.value);
    }

    if (quantity === null || Number.isNaN(quantity)) return;
    if (!Number.isInteger(quantity) || quantity < material.min || (typeof material.max === 'number' && quantity > material.max)) return;
    if (quantity === 0) return;

    selected.push({
      name: material.name,
      quantity,
      unitLabel: material.unitLabel,
      materialId: material.id,
    });
  });

  return selected;
}

function buildTelegramMessage(data, selectedMaterials, generatedAt) {
  const materialsText = selectedMaterials.length
    ? selectedMaterials.map((item) => `🔹 ${item.name}: ${formatQuantity(item.quantity, MATERIALS.find((m) => m.id === item.materialId))}`).join('\n')
    : '🔹 Nenhum material selecionado';

  return [
    SECTION_TITLE,
    MESSAGE_TITLE,
    '',
    `👷 Técnico: ${data.technicianName}`,
    `🏢 Base: ${BASE_NAME}`,
    `📅 Data: ${generatedAt.date}`,
    `⏰ Horário: ${generatedAt.time}`,
    '',
    '🧰 Suprimentos Solicitados:',
    '------------------------------',
    materialsText,
    '------------------------------',
  ].join('\n');
}

function validateFields() {
let valido = true;

const itens = document.querySelectorAll('.material-item');

itens.forEach(item => {
const checkbox = item.querySelector('input[type="checkbox"]');
const select = item.querySelector('select');
const titulo = item.querySelector('.material-name');

// limpa erro
titulo.classList.remove('erro');
select.classList.remove('borda-erro');

if (checkbox.checked && (!select.value || select.value === '')) {
titulo.classList.add('erro');
select.classList.add('borda-erro');
valido = false;
}

});

return valido;
}

async function sendToTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_BOT_TOKEN.includes('COLOQUE_') || TELEGRAM_CHAT_ID.includes('COLOQUE_')) {
    throw new Error('Configure o token e o chat_id do Telegram no código.');
  }

  if (!validateFields()) {
    throw new Error('Preencha a quantidade dos itens selecionados!');
  return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const description = result?.description || `HTTP ${response.status}`;
    throw new Error(`Falha ao enviar requisição: ${description}`);
  }

  downloadTXT(message)
  return result;
}

function downloadTXT(conteudo) {
  const agora = new Date();

  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();

  const nomeArquivo = `requisicao-estoque-${dia}-${mes}-${ano}.txt`;

  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function validateForm() {
  const technicianName = sanitizeText(technicianInput.value);
  if (!technicianName) {
    showFeedback('error', 'Informe o nome do técnico antes de enviar.');
    technicianInput.focus();
    return false;
  }

  const selectedMaterials = getSelectedMaterials();
  if (!selectedMaterials.length) {
    showFeedback('error', 'Selecione ao menos um material com quantidade válida.');
    return false;
  }

  return true;
}

function collectFormData() {
  return {
    technicianName: sanitizeText(technicianInput.value),
  };
}

function clearSelection() {
  document.querySelectorAll('.material-item').forEach((item) => {
    const checkbox = item.querySelector('.material-check');
    const qtyInput = item.querySelector('.qty-input');
    const material = MATERIALS.find((entry) => entry.id === item.dataset.materialId);

    checkbox.checked = false;
    if (material?.type === 'select') {
      qtyInput.selectedIndex = 0;
    } else {
      qtyInput.value = '';
    }
    item.classList.remove('selected');
    item.querySelector('.qty-wrap').style.display = 'none';
  });
}

function verificarDia() {
  try {
  const status = document.getElementById('status-dia');

  const hoje = new Date().getDay(); 
  // 0 = domingo, 1 = segunda, 2 = terça...

  const diasPermitidos = [2, 4, 6]; // terça, quinta, sábado

  const nomesDias = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  status.textContent = `${nomesDias[hoje]}`;

  if (diasPermitidos.includes(hoje)) {
    status.classList.add('ok');
    status.classList.remove('erro');
  } else {
    status.classList.add('erro');
    status.classList.remove('ok');
  }
    } catch (error) {
    console.error(error);
    showFeedback('error', error.message);
  }
}

verificarDia();

const selects = document.querySelectorAll('.qty-input');

selects.forEach(select => {
  const label = document.querySelector(`label[for="${select.id}"]`);

  const update = () => {
    label.classList.toggle('label-placeholder', select.value !== '');
  };

  update();
  select.addEventListener('change', update);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFeedback();

  if (!validateForm()) return;

  const data = collectFormData();
  const selectedMaterials = getSelectedMaterials();
  const generatedAt = formatDateTime(new Date());
  const telegramMessage = buildTelegramMessage(data, selectedMaterials, generatedAt);

  try {
    await sendToTelegram(telegramMessage);
    showFeedback('success', 'Solicitação enviada com sucesso.');
  } catch (error) {
    console.error(error);
    showFeedback('error', error.message);
  }
});

clearSelectionBtn.addEventListener('click', () => {
  clearSelection();
  showFeedback('info', 'Seleção de materiais limpa.');
});

renderMaterials();

if (!technicianInput.value) {
  technicianInput.focus();
}
