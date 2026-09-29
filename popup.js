const DEFAULTS = {
  engine: 'auto',
  targetLang: 'zh-CN',
  autoLookup: true,
  customEndpoint: 'https://api.deepseek.com/chat/completions',
  customKey: '',
  customModel: 'deepseek-chat'
};

const engine = document.getElementById('engine');
const targetLang = document.getElementById('targetLang');
const autoLookup = document.getElementById('autoLookup');
const customSection = document.getElementById('customSection');
const customEndpoint = document.getElementById('customEndpoint');
const customKey = document.getElementById('customKey');
const customModel = document.getElementById('customModel');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const tabButtons = document.querySelectorAll('.tab');
const settingsView = document.getElementById('settingsView');
const vocabView = document.getElementById('vocabView');
const settingsFooter = document.getElementById('settingsFooter');
const vocabCount = document.getElementById('vocabCount');
const vocabSearch = document.getElementById('vocabSearch');
const vocabClear = document.getElementById('vocabClear');
const vocabList = document.getElementById('vocabList');
const vocabEmpty = document.getElementById('vocabEmpty');

let settings = { ...DEFAULTS };

function applyUI() {
  engine.value = settings.engine;
  targetLang.value = settings.targetLang;
  autoLookup.checked = settings.autoLookup;
  customEndpoint.value = settings.customEndpoint;
  customKey.value = settings.customKey;
  customModel.value = settings.customModel;
  customSection.hidden = settings.engine !== 'custom';
}

function readUI() {
  settings.engine = engine.value;
  settings.targetLang = targetLang.value;
  settings.autoLookup = autoLookup.checked;
  settings.customEndpoint = customEndpoint.value.trim() || DEFAULTS.customEndpoint;
  settings.customKey = customKey.value.trim();
  settings.customModel = customModel.value.trim() || DEFAULTS.customModel;
  customSection.hidden = settings.engine !== 'custom';
}

function save() {
  readUI();
  chrome.storage.sync.set(settings, () => {
    statusEl.textContent = '已保存';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1400);
  });
}

engine.addEventListener('change', () => {
  readUI();
  customSection.hidden = settings.engine !== 'custom';
  chrome.storage.sync.set(settings);
});

targetLang.addEventListener('change', () => chrome.storage.sync.set({ targetLang: targetLang.value }));
autoLookup.addEventListener('change', () => chrome.storage.sync.set({ autoLookup: autoLookup.checked }));
saveBtn.addEventListener('click', save);

chrome.storage.sync.get(DEFAULTS, (stored) => {
  settings = { ...DEFAULTS, ...stored };
  applyUI();
});

let vocabItems = [];
let clearArmed = false;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function phoneticLabel(item) {
  const phones = [];
  if (item.ukphone) phones.push('英 /' + item.ukphone + '/');
  if (item.usphone) phones.push('美 /' + item.usphone + '/');
  if (!phones.length && item.phonetic) phones.push('/' + item.phonetic + '/');
  return phones.join(' ');
}

function updateVocabCount() {
  const n = vocabItems.length;
  vocabCount.textContent = n > 0 ? String(n) : '';
  vocabCount.hidden = n === 0;
}

function renderVocab() {
  const query = vocabSearch.value.trim().toLowerCase();
  const filtered = query
    ? vocabItems.filter((item) => String(item.word).toLowerCase().includes(query))
    : vocabItems;
  vocabList.innerHTML = '';
  vocabEmpty.hidden = filtered.length > 0;
  filtered.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'vocab-item';
    const ph = phoneticLabel(item);
    li.innerHTML =
      '<div class="vocab-main">' +
      '<div class="vocab-word">' +
      escapeHtml(item.word) +
      (ph ? '<span class="vocab-ph">' + escapeHtml(ph) + '</span>' : '') +
      '</div>' +
      (item.brief ? '<div class="vocab-brief">' + escapeHtml(item.brief) + '</div>' : '') +
      '</div>' +
      '<button class="vocab-del" data-word="' +
      escapeHtml(item.word) +
      '" aria-label="删除">×</button>';
    vocabList.appendChild(li);
    li.querySelector('.vocab-del').addEventListener('click', () => removeVocab(item.word));
  });
}

function removeVocab(word) {
  vocabItems = vocabItems.filter((item) => item.word !== word);
  chrome.storage.local.set({ vocabulary: vocabItems }, () => {
    updateVocabCount();
    renderVocab();
  });
}

function clearVocab() {
  clearArmed = false;
  vocabClear.textContent = '清空';
  vocabItems = [];
  chrome.storage.local.set({ vocabulary: [] }, () => {
    updateVocabCount();
    renderVocab();
  });
}

function loadVocab() {
  chrome.storage.local.get({ vocabulary: [] }, (data) => {
    vocabItems = data.vocabulary || [];
    updateVocabCount();
    renderVocab();
  });
}

function switchView(view) {
  const isVocab = view === 'vocab';
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  settingsView.hidden = isVocab;
  settingsFooter.hidden = isVocab;
  vocabView.hidden = !isVocab;
  if (isVocab) loadVocab();
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

vocabSearch.addEventListener('input', renderVocab);

vocabClear.addEventListener('click', () => {
  if (vocabItems.length === 0) return;
  if (!clearArmed) {
    clearArmed = true;
    vocabClear.textContent = '确认清空？';
    setTimeout(() => {
      clearArmed = false;
      vocabClear.textContent = '清空';
    }, 2000);
    return;
  }
  clearVocab();
});
