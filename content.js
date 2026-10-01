const HOST_ID = 'readmate-root';
const MAX_LEN = 5000;
const BUBBLE_WIDTH = 480;

if (document.getElementById(HOST_ID)) {
  document.getElementById(HOST_ID).remove();
}

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
.rm-btn {
  position: fixed;
  z-index: 2147483647;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  line-height: 30px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.25);
  user-select: none;
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.rm-btn:hover { background: #1d4ed8; }
.rm-bubble {
  position: fixed;
  z-index: 2147483647;
  width: 480px;
  max-width: calc(100vw - 16px);
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 12px 36px rgba(0,0,0,.28);
  border: 1px solid #e5e7eb;
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  overflow: hidden;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
}
.rm-bubble[hidden], .rm-btn[hidden] { display: none; }
.rm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  cursor: move;
  user-select: none;
}
.rm-meta { font-size: 12px; color: #64748b; }
.rm-close {
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.rm-close:hover { color: #111827; }
.rm-src {
  padding: 10px 12px 4px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.rm-trans {
  padding: 4px 12px 12px;
  color: #111827;
  font-size: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.rm-dict {
  margin: 0 12px 12px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 13px;
  line-height: 1.55;
}
.rm-dict[hidden] { display: none; }
.rm-dict-loading { color: #64748b; }
.rm-dict-ph { color: #2563eb; margin-bottom: 6px; }
.rm-dict-line { color: #374151; }
.rm-dict-ex { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db; }
.rm-ex { display: flex; flex-direction: column; margin-bottom: 6px; }
.rm-ex-en { color: #111827; }
.rm-ex-zh { color: #64748b; }
.rm-more {
  display: block;
  width: 100%;
  margin-top: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 6px;
  padding: 6px 9px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.rm-more:hover { background: #dbeafe; }
.rm-detail { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb; max-height: 320px; overflow-y: auto; }
.rm-detail[hidden] { display: none; }
.rm-pos { font-weight: 600; color: #111827; margin: 6px 0 3px; }
.rm-def { color: #374151; margin-bottom: 6px; }
.rm-def-ex { color: #64748b; margin-top: 2px; }
.rm-def-syn { color: #64748b; margin-top: 2px; font-size: 12px; }
.rm-forms { color: #64748b; margin-top: 8px; font-size: 12px; }
.rm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 12px;
}
.rm-actions button {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}
.rm-actions button:hover { background: #f1f5f9; }
.rm-save { color: #b45309; }
.rm-save.saved { color: #1d4ed8; border-color: #dbeafe; background: #eff6ff; }
.rm-compact .rm-src { padding: 8px 10px 4px; font-size: 12px; }
.rm-compact .rm-trans { padding: 4px 10px 8px; font-size: 15px; }
.rm-compact .rm-dict { margin: 0 10px 8px; padding: 8px; }
.rm-compact .rm-dict-line {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.rm-compact .rm-actions { padding: 0 10px 10px; gap: 4px; }
.rm-compact .rm-actions button { padding: 4px 8px; font-size: 11px; }
.rm-spin {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #cbd5e1;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: rm-spin .7s linear infinite;
}
@keyframes rm-spin { to { transform: rotate(360deg); } }
`;

const host = document.createElement('div');
host.id = HOST_ID;
host.style.position = 'fixed';
host.style.zIndex = '2147483647';
document.documentElement.appendChild(host);

const shadow = host.attachShadow({ mode: 'closed' });
const styleEl = document.createElement('style');
styleEl.textContent = STYLE;
shadow.appendChild(styleEl);

const btn = document.createElement('button');
btn.className = 'rm-btn';
btn.textContent = '译';
btn.setAttribute('aria-label', '翻译选中内容');
btn.setAttribute('hidden', '');
shadow.appendChild(btn);

const bubble = document.createElement('div');
bubble.className = 'rm-bubble';
bubble.setAttribute('hidden', '');
bubble.innerHTML = `
  <div class="rm-head">
    <span class="rm-meta"></span>
    <button class="rm-close" aria-label="关闭">×</button>
  </div>
  <div class="rm-src"></div>
  <div class="rm-trans"></div>
  <div class="rm-dict"></div>
  <div class="rm-actions">
    <button class="rm-retry" hidden>重试</button>
    <button class="rm-copy">复制</button>
    <button class="rm-speak">朗读原文</button>
    <button class="rm-save" hidden>☆ 收藏</button>
  </div>
`;
shadow.appendChild(bubble);

const meta = bubble.querySelector('.rm-meta');
const srcEl = bubble.querySelector('.rm-src');
const transEl = bubble.querySelector('.rm-trans');
const dictEl = bubble.querySelector('.rm-dict');
const closeBtn = bubble.querySelector('.rm-close');
const retryBtn = bubble.querySelector('.rm-retry');
const copyBtn = bubble.querySelector('.rm-copy');
const speakBtn = bubble.querySelector('.rm-speak');
const saveBtn = bubble.querySelector('.rm-save');
const headEl = bubble.querySelector('.rm-head');

let currentText = '';
let currentRect = null;
let anchorRect = null;
let selectionTimer = null;
let lastResult = null;
let lastText = '';
let currentWord = '';
let currentRange = null;
let lastDictionary = null;
let translationId = 0;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function chromeAvailable() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (err) {
    return false;
  }
}

function getSettings() {
  return new Promise((resolve) => {
    if (!chromeAvailable()) {
      resolve({ engine: 'auto', targetLang: 'zh-CN', autoLookup: true });
      return;
    }
    chrome.storage.sync.get(
      { engine: 'auto', targetLang: 'zh-CN', autoLookup: true },
      resolve
    );
  });
}

function hideButton() {
  btn.setAttribute('hidden', '');
}

function showButton(rect) {
  btn.removeAttribute('hidden');
  const x = Math.min(Math.max(8, rect.right + 6), window.innerWidth - 38);
  const y = Math.min(Math.max(8, rect.top - 34), window.innerHeight - 38);
  btn.style.left = x + 'px';
  btn.style.top = y + 'px';
}

function handleSelection() {
  const selection = window.getSelection();
  const text = selectedText(selection);
  if (!text || text.length > MAX_LEN) {
    currentText = '';
    currentRect = null;
    hideButton();
    return;
  }
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    currentText = '';
    currentRect = currentRange = null;
    hideButton();
    return;
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const inViewport = rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
  if (!inViewport) {
    currentText = '';
    currentRect = currentRange = null;
    hideButton();
    return;
  }
  currentText = text;
  currentRect = rect;
  currentRange = range.cloneRange ? range.cloneRange() : range;
  showButton(rect);
}

function scheduleSelection() {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(handleSelection, 120);
}

function selectedText(selection) {
  if (window.ReadMatePdfText) return window.ReadMatePdfText.readSelection(selection);
  return selection ? selection.toString().trim() : '';
}

function setLoading(text) {
  bubble.removeAttribute('hidden');
  retryBtn.setAttribute('hidden', '');
  meta.textContent = '正在翻译…';
  srcEl.textContent = truncate(text, 160);
  transEl.innerHTML = '<span class="rm-spin"></span>';
  dictEl.setAttribute('hidden', '');
  dictEl.innerHTML = '';
  currentWord = '';
  lastDictionary = null;
  saveBtn.setAttribute('hidden', '');
  lastResult = null;
  lastText = text;
  positionBubble();
}

function positionBubble(rect) {
  const r = rect || getLiveRect();
  const text = lastText || currentText;
  const compact = !!window.ReadMatePdfText && /^[^\s]{1,64}$/.test(text);
  const preferredWidth = compact ? 280 : (window.ReadMatePdfText ? 360 : BUBBLE_WIDTH);
  if (compact) bubble.classList.add('rm-compact');
  else bubble.classList.remove('rm-compact');
  const width = Math.min(preferredWidth, window.innerWidth - 16);
  bubble.style.width = width + 'px';
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  let x = r ? r.left : window.innerWidth / 2 - bw / 2;
  let y = r ? r.bottom + 8 : window.innerHeight / 2 - bh / 2;
  if (x + bw > window.innerWidth - 8) x = window.innerWidth - bw - 8;
  if (x < 8) x = 8;
  if (y + bh > window.innerHeight - 8) {
    y = r ? r.top - bh - 8 : window.innerHeight - bh - 8;
  }
  if (y < 8) y = 8;
  bubble.style.left = x + 'px';
  bubble.style.top = y + 'px';
}

function getLiveRect() {
  if (currentRange) {
    try {
      const r = currentRange.getBoundingClientRect();
      if (r && (r.width !== 0 || r.height !== 0)) return r;
    } catch (err) {
      // ignore
    }
  }
  return anchorRect || currentRect;
}

function setDictVisible(visible) {
  if (visible) dictEl.removeAttribute('hidden');
  else dictEl.setAttribute('hidden', '');
}

function basicDefinitions(dict) {
  if (dict.translations && dict.translations.length) {
    return dict.translations
      .slice(0, 2)
      .map((line) => {
        const senses = String(line)
          .split(/[；;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        return senses.length > 2 ? senses.slice(0, 2).join('；') : line;
      });
  }
  const out = [];
  if (dict.meanings) {
    for (const m of dict.meanings) {
      for (const d of m.definitions || []) {
        out.push((m.partOfSpeech ? m.partOfSpeech + ' ' : '') + d.definition);
        if (out.length >= 2) break;
      }
      if (out.length >= 2) break;
    }
  }
  return out;
}

function buildDetailHtml(dict) {
  const parts = [];
  if (dict.meanings && dict.meanings.length) {
    dict.meanings.forEach((m) => {
      if (m.partOfSpeech) parts.push('<div class="rm-pos">' + escapeHtml(m.partOfSpeech) + '</div>');
      (m.definitions || []).forEach((d) => {
        parts.push('<div class="rm-def">' + escapeHtml(d.definition) + '</div>');
        if (d.example) parts.push('<div class="rm-def-ex">例：' + escapeHtml(d.example) + '</div>');
        if (d.synonyms && d.synonyms.length) {
          parts.push('<div class="rm-def-syn">同义词：' + d.synonyms.map(escapeHtml).join('、') + '</div>');
        }
      });
    });
  }
  if (dict.phrases && dict.phrases.length) {
    parts.push('<div class="rm-pos">短语</div>');
    dict.phrases.forEach((p) => {
      parts.push('<div class="rm-def">' + escapeHtml(p) + '</div>');
    });
  }
  if (dict.examples && dict.examples.length) {
    parts.push(
      '<div class="rm-dict-ex">' +
        dict.examples
          .map(
            (e) =>
              '<div class="rm-ex"><span class="rm-ex-en">' +
              escapeHtml(e.en) +
              '</span><span class="rm-ex-zh">' +
              escapeHtml(e.zh) +
              '</span></div>'
          )
          .join('') +
        '</div>'
    );
  }
  if (dict.forms && dict.forms.length) {
    parts.push(
      '<div class="rm-forms">词形变化：' +
        dict.forms.map((f) => escapeHtml(f.name + ' ' + f.value)).join('；') +
        '</div>'
    );
  }
  return parts.join('');
}

function renderDictionary(dict) {
  const parts = [];
  const phones = [];
  if (dict.ukphone) phones.push('英 /' + dict.ukphone + '/');
  if (dict.usphone) phones.push('美 /' + dict.usphone + '/');
  if (!phones.length && dict.phonetic) phones.push('/' + dict.phonetic + '/');
  if (phones.length) parts.push('<div class="rm-dict-ph">' + escapeHtml(phones.join('　')) + '</div>');
  const defs = basicDefinitions(dict);
  if (defs.length) {
    parts.push(
      '<div class="rm-dict-line">' +
        defs.map((t) => escapeHtml(t)).join('<br>') +
        '</div>'
    );
  }
  const detailHtml = buildDetailHtml(dict);
  if (detailHtml) {
    parts.push('<button type="button" class="rm-more" data-rm-toggle>详细释义 ▾</button>');
    parts.push('<div class="rm-detail" hidden>' + detailHtml + '</div>');
  }
  dictEl.innerHTML = parts.join('');

  const toggle = dictEl.querySelector('[data-rm-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const detail = dictEl.querySelector('.rm-detail');
      if (detail.hasAttribute('hidden')) {
        detail.removeAttribute('hidden');
        toggle.textContent = '收起释义 ▴';
      } else {
        detail.setAttribute('hidden', '');
        toggle.textContent = '详细释义 ▾';
      }
      positionBubble();
    });
  }
}

function showResult(result, originalText) {
  bubble.removeAttribute('hidden');
  retryBtn.setAttribute('hidden', '');
  lastResult = result;
  lastText = originalText;
  meta.textContent = result.engine + (result.detectedLang ? ' · ' + result.detectedLang : '');
  srcEl.textContent = truncate(originalText, 160);
  transEl.textContent = result.translated;
  if (result.isWord) {
    currentWord = originalText;
    setDictVisible(true);
    dictEl.innerHTML = '<div class="rm-dict-loading">词典加载中…</div>';
    saveBtn.removeAttribute('hidden');
    updateSaveButton();
  } else {
    currentWord = '';
    lastDictionary = null;
    setDictVisible(false);
    dictEl.innerHTML = '';
    saveBtn.setAttribute('hidden', '');
  }
  positionBubble();
}

function showError(message) {
  bubble.removeAttribute('hidden');
  retryBtn.removeAttribute('hidden');
  meta.textContent = '翻译失败';
  srcEl.textContent = truncate(currentText, 160);
  transEl.textContent = message;
  setDictVisible(false);
  dictEl.innerHTML = '';
  positionBubble();
}

function handleDictionaryResult(word, dictionary) {
  if (word !== currentWord) return;
  if (dictionary) {
    lastDictionary = dictionary;
    setDictVisible(true);
    renderDictionary(dictionary);
    enrichSavedWord(word, dictionary);
  } else {
    lastDictionary = null;
    setDictVisible(true);
    dictEl.innerHTML = '<div class="rm-dict-loading">未找到词典</div>';
  }
  positionBubble();
}

function enrichSavedWord(word, dictionary) {
  if (!chromeAvailable()) return;
  chrome.storage.local.get({ vocabulary: [] }, (data) => {
    const list = data.vocabulary || [];
    const item = list.find((v) => v.word === word);
    if (!item) return;
    item.phonetic = (dictionary.phonetic || item.phonetic || '');
    item.ukphone = (dictionary.ukphone || item.ukphone || '');
    item.usphone = (dictionary.usphone || item.usphone || '');
    item.brief = basicDefinitions(dictionary).join('；') || item.brief;
    item.detail = dictionary;
    chrome.storage.local.set({ vocabulary: list });
  });
}

function updateSaveButton() {
  const word = currentWord;
  if (!word || !chromeAvailable()) return;
  chrome.storage.local.get({ vocabulary: [] }, (data) => {
    if (word !== currentWord) return;
    const list = data.vocabulary || [];
    const isSaved = list.some((item) => item.word === word);
    saveBtn.textContent = isSaved ? '★ 已收藏' : '☆ 收藏';
    if (isSaved) saveBtn.classList.add('saved');
    else saveBtn.classList.remove('saved');
  });
}

function toggleSave() {
  const word = currentWord;
  if (!word || !chromeAvailable()) return;
  chrome.storage.local.get({ vocabulary: [] }, (data) => {
    if (word !== currentWord) return;
    const list = data.vocabulary || [];
    const idx = list.findIndex((item) => item.word === word);
    if (idx >= 0) {
      list.splice(idx, 1);
      saveBtn.textContent = '☆ 收藏';
      saveBtn.classList.remove('saved');
    } else {
      const brief = lastDictionary ? basicDefinitions(lastDictionary).join('；') : '';
      list.unshift({
        word,
        phonetic: (lastDictionary && lastDictionary.phonetic) || '',
        ukphone: (lastDictionary && lastDictionary.ukphone) || '',
        usphone: (lastDictionary && lastDictionary.usphone) || '',
        brief,
        detail: lastDictionary || null,
        addedAt: Date.now()
      });
      saveBtn.textContent = '★ 已收藏';
      saveBtn.classList.add('saved');
    }
    chrome.storage.local.set({ vocabulary: list });
  });
}

function startTranslate(text, rect) {
  if (!text) return;
  const requestId = ++translationId;
  anchorRect = rect || currentRect;
  currentText = text;
  hideButton();
  setLoading(text);
  if (!chromeAvailable()) {
    showError('插件已重新加载，请刷新本页后重试');
    return;
  }
  chrome.runtime.sendMessage({ type: 'TRANSLATE', text }, (response) => {
    if (requestId !== translationId) return;
    if (chrome.runtime.lastError) {
      showError(chrome.runtime.lastError.message || '插件通信失败');
      return;
    }
    if (response && response.error) {
      showError(response.error);
    } else if (response && response.translated) {
      showResult(response, text);
    } else {
      showError('翻译结果为空');
    }
  });
}

function hideBubble() {
  translationId++;
  currentWord = '';
  bubble.setAttribute('hidden', '');
  hideButton();
}

btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
btn.addEventListener('click', () => {
  startTranslate(currentText, currentRect);
});

bubble.addEventListener('pointerdown', (e) => e.stopPropagation());

closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
closeBtn.addEventListener('click', hideBubble);

retryBtn.addEventListener('click', () => {
  startTranslate(lastText || currentText, anchorRect);
});

copyBtn.addEventListener('click', async () => {
  const text = transEl.textContent || '';
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const old = copyBtn.textContent;
    copyBtn.textContent = '已复制';
    setTimeout(() => {
      copyBtn.textContent = old;
    }, 1200);
  } catch (err) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      const old = copyBtn.textContent;
      copyBtn.textContent = '已复制';
      setTimeout(() => {
        copyBtn.textContent = old;
      }, 1200);
    } catch (err2) {
      // 剪贴板不可用时忽略
    }
  }
});

function speechLang(code) {
  if (!code) return '';
  const m = String(code).toLowerCase().match(/^([a-z]{2})/);
  return m ? m[1] : '';
}

function guessLangFromText(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja-JP';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
  if (/[a-zA-Z]/.test(text)) return 'en-US';
  return '';
}

speakBtn.addEventListener('click', () => {
  const text = lastText || currentText || '';
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = speechLang(lastResult && lastResult.detectedLang) || guessLangFromText(text);
  if (lang) utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
});

saveBtn.addEventListener('click', toggleSave);

let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

headEl.addEventListener('pointerdown', (e) => {
  dragging = true;
  const rect = bubble.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  headEl.setPointerCapture(e.pointerId);
});

headEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  bubble.style.left = e.clientX - dragOffsetX + 'px';
  bubble.style.top = e.clientY - dragOffsetY + 'px';
});

headEl.addEventListener('pointerup', () => {
  dragging = false;
});

headEl.addEventListener('pointercancel', () => {
  dragging = false;
});

document.addEventListener('mouseup', scheduleSelection);
document.addEventListener('selectionchange', scheduleSelection);
document.addEventListener('touchend', scheduleSelection);
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
    scheduleSelection();
  }
});
document.addEventListener('pointerdown', () => {
  if (!bubble.hasAttribute('hidden')) hideBubble();
});
document.addEventListener(
  'scroll',
  () => {
    if (btn.hasAttribute('hidden') && bubble.hasAttribute('hidden')) return;
    const rect = getLiveRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
    if (!visible) {
      hideButton();
      hideBubble();
      return;
    }
    if (!btn.hasAttribute('hidden')) {
      btn.style.left = Math.min(Math.max(8, rect.right + 6), vw - 38) + 'px';
      btn.style.top = Math.min(Math.max(8, rect.top - 34), vh - 38) + 'px';
    }
    if (!bubble.hasAttribute('hidden')) {
      positionBubble(rect);
    }
  },
  true
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideBubble();
    hideButton();
  }
});
document.addEventListener('dblclick', async () => {
  const settings = await getSettings();
  if (!settings.autoLookup) return;
  setTimeout(() => {
    handleSelection();
    if (currentText) startTranslate(currentText, currentRect);
  }, 80);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'TRANSLATE_SELECTION') {
    handleSelection();
    const text = window.ReadMatePdfText ? currentText : (message.text || currentText);
    if (text) startTranslate(text, currentRect);
    sendResponse({ ok: true });
    return false;
  }
  if (message && message.type === 'DICTIONARY_RESULT') {
    handleDictionaryResult(message.word, message.dictionary);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

if (window.ReadMatePdfText) {
  document.addEventListener('keydown', (event) => {
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyT') {
      event.preventDefault();
      handleSelection();
      if (currentText) startTranslate(currentText, currentRect);
    }
  });
  document.addEventListener('readmate-pdf-reset', () => {
    hideBubble();
    currentText = lastText = '';
    currentRange = currentRect = anchorRect = null;
  });
}
