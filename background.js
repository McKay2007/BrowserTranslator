const DEFAULTS = {
  engine: 'auto',
  targetLang: 'zh-CN',
  autoLookup: true,
  customEndpoint: 'https://api.deepseek.com/chat/completions',
  customKey: '',
  customModel: 'deepseek-chat'
};

function safeSendResponse(sendResponse, data) {
  try {
    sendResponse(data);
  } catch (err) {
    // The extension was reloaded while a request was in flight.
  }
}

function sendToTab(tabId, message) {
  try {
    chrome.tabs.sendMessage(tabId, message).catch(() => {});
  } catch (err) {
    // The tab is gone or the extension context was invalidated.
  }
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, resolve);
  });
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function guessSource(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  return 'en';
}

function toMyMemoryTarget(target) {
  const map = {
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    en: 'en-GB',
    ja: 'ja-JP',
    ko: 'ko-KR',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
    ru: 'ru-RU',
    pt: 'pt-PT',
    it: 'it-IT',
    vi: 'vi-VN',
    th: 'th-TH',
    id: 'id-ID',
    ar: 'ar-SA'
  };
  return map[target] || target;
}

function toGoogleTarget(target) {
  const map = {
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    de: 'de',
    es: 'es',
    ru: 'ru',
    pt: 'pt',
    it: 'it',
    vi: 'vi',
    th: 'th',
    id: 'id',
    ar: 'ar'
  };
  return map[target] || target;
}

async function translateYoudao(text) {
  const url = 'https://fanyi.youdao.com/translate?doctype=json&type=AUTO&i=' + encodeURIComponent(text);
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  if (!data || data.errorCode !== 0 || !Array.isArray(data.translateResult)) {
    throw new Error('有道翻译返回异常');
  }
  const translated = data.translateResult
    .flat()
    .map((item) => item && item.tgt)
    .filter(Boolean)
    .join('');
  if (!translated) throw new Error('有道翻译无结果');
  const type = String(data.type || '');
  const detected = type.split('2')[0] || 'AUTO';
  return { translated, engine: '有道', detectedLang: detected, provider: 'youdao' };
}

async function translateGoogle(text, target) {
  const tl = toGoogleTarget(target);
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    tl +
    '&dt=t&q=' +
    encodeURIComponent(text);
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google 翻译返回异常');
  }
  const translated = data[0]
    .map((seg) => seg && seg[0])
    .filter(Boolean)
    .join('');
  if (!translated) throw new Error('Google 翻译无结果');
  return { translated, engine: 'Google', detectedLang: data[2] || 'auto', provider: 'google' };
}

async function translateMyMemory(text, target) {
  const tl = toMyMemoryTarget(target);
  const tryWith = async (source) => {
    const url =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(text) +
      '&langpair=' +
      encodeURIComponent(source + '|' + tl);
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    if (!data || data.responseStatus !== 200 || !data.responseData) {
      throw new Error(data && data.responseDetails ? data.responseDetails : 'MyMemory 翻译失败');
    }
    const translated = data.responseData.translatedText;
    if (
      !translated ||
      /^(please|query|no query|mymemory|invalid)/i.test(String(translated).trim())
    ) {
      throw new Error('MyMemory 无法翻译该文本');
    }
    return {
      translated,
      engine: 'MyMemory',
      detectedLang: data.responseData.detectedLanguage || source,
      provider: 'mymemory'
    };
  };
  try {
    return await tryWith('autodetect');
  } catch (err) {
    return await tryWith(guessSource(text));
  }
}

async function translateCustom(text, target, settings) {
  const endpoint = settings.customEndpoint || DEFAULTS.customEndpoint;
  const key = settings.customKey || '';
  const model = settings.customModel || DEFAULTS.customModel;
  const targetName = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    en: '英语',
    ja: '日语',
    ko: '韩语',
    fr: '法语',
    de: '德语',
    es: '西班牙语',
    ru: '俄语',
    pt: '葡萄牙语',
    it: '意大利语',
    vi: '越南语',
    th: '泰语',
    id: '印度尼西亚语',
    ar: '阿拉伯语'
  }[target] || target;

  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = 'Bearer ' + key;
  const body = {
    model,
    messages: [
      {
        role: 'system',
        content:
          '你是一名专业翻译。把用户输入翻译成' +
          targetName +
          '，只输出译文本身，不要解释，不要加引号。'
      },
      { role: 'user', content: text }
    ],
    temperature: 0.2
  };
  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('自定义接口请求失败 (HTTP ' + res.status + ')');
  const data = await res.json();
  const translated =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  if (!translated) throw new Error('自定义接口返回格式异常');
  return { translated: String(translated).trim(), engine: '自定义', detectedLang: null, provider: 'custom' };
}

async function translateWithEngine(engine, text, target, settings) {
  if (engine === 'youdao') {
    if (target !== 'zh-CN') {
      throw new Error('有道接口仅支持译成简体中文，请改用 Google 或自定义接口');
    }
    return translateYoudao(text);
  }
  if (engine === 'google') return translateGoogle(text, target);
  if (engine === 'mymemory') return translateMyMemory(text, target);
  if (engine === 'custom') return translateCustom(text, target, settings);
  throw new Error('未知翻译引擎: ' + engine);
}

async function translateAuto(text, target, settings) {
  const order = target === 'zh-CN' ? ['youdao', 'google', 'mymemory'] : ['google', 'mymemory'];
  let lastError = null;
  for (const engine of order) {
    try {
      return await translateWithEngine(engine, text, target, settings);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('所有翻译服务均不可用');
}

async function youdaoDictionary(word) {
  const dicts = JSON.stringify({
    count: 99,
    dicts: [['ec', 'ce', 'simple', 'blng_sents_part', 'wordform', 'phrs', 'longman']]
  });
  const url =
    'https://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&q=' +
    encodeURIComponent(word) +
    '&dicts=' +
    encodeURIComponent(dicts);
  const res = await fetchWithTimeout(url, {}, 6000);
  const data = await res.json();
  const ec = data && data.ec && data.ec.word && data.ec.word[0];
  const ce = data && data.ce && data.ce.word && data.ce.word[0];
  const simple = data && data.simple && data.simple.word && data.simple.word[0];

  const parseTrs = (node) =>
    (node.trs || [])
      .map((item) => {
        const tr = item && item.tr;
        if (Array.isArray(tr)) {
          return tr
            .map((t) => (t && t.l && Array.isArray(t.l.i) ? t.l.i.join('；') : ''))
            .filter(Boolean)
            .join('；');
        }
        return '';
      })
      .filter(Boolean);

  let translations = [];
  if (ec) translations = parseTrs(ec);
  if (!translations.length && ce) translations = parseTrs(ce);

  const examples = [];
  const blng = data && data.blng_sents_part;
  const pairs = blng && (blng['sentence-pair'] || blng.sentence_pair);
  if (Array.isArray(pairs)) {
    for (const sp of pairs.slice(0, 4)) {
      const en = sp && (sp.sentence || sp['sentence-eng']);
      const zh = sp && sp['sentence-translation'];
      if (en && zh) {
        examples.push({
          en: String(en).replace(/<[^>]+>/g, ''),
          zh: String(zh).replace(/<[^>]+>/g, '')
        });
      }
    }
  }

  const forms = (ec && ec.wfs ? ec.wfs : [])
    .map((w) => {
      const wf = w && w.wf;
      return wf && wf.name && wf.value ? { name: String(wf.name), value: String(wf.value) } : null;
    })
    .filter(Boolean);

  const usphone = (ec && ec.usphone) || (simple && simple.usphone) || '';
  const ukphone = (ec && ec.ukphone) || (simple && simple.ukphone) || '';

  const meanings = parseEcMeanings(ec);
  const longmanMeanings = parseLongmanMeanings(data);
  if (longmanMeanings.length) meanings.push(...longmanMeanings);

  return {
    translations,
    usphone,
    ukphone,
    forms,
    examples,
    meanings,
    phrases: parsePhrases(data)
  };
}

function parseEcMeanings(ec) {
  const out = [];
  const trs = ec && ec.trs;
  if (!Array.isArray(trs)) return out;
  for (const item of trs) {
    const tr = item && item.tr;
    if (!Array.isArray(tr)) continue;
    for (const t of tr) {
      const i = t && t.l && Array.isArray(t.l.i) ? t.l.i : [];
      const raw = i.join('；').trim();
      if (!raw) continue;
      const m = raw.match(/^([A-Za-z]+\.)\s*([\s\S]*)$/);
      const partOfSpeech = m ? m[1] : '';
      const rest = m ? m[2] : raw;
      const senses = rest
        .split(/[；;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!senses.length) senses.push(rest);
      out.push({
        partOfSpeech,
        definitions: senses.map((s) => ({ definition: s, example: '', synonyms: [] }))
      });
    }
  }
  return out;
}

function parsePhrases(data) {
  const list = data && data.phrs && data.phrs.phrs;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const phr = item && item.phr;
      const head = phr && phr.headword && phr.headword.l && phr.headword.l.i;
      const trs = phr && phr.trs;
      const tr = Array.isArray(trs) && trs[0] && trs[0].tr && trs[0].tr.l && trs[0].tr.l.i;
      if (!head || !tr) return null;
      return String(head) + '　' + String(tr);
    })
    .filter(Boolean)
    .slice(0, 8);
}

function parseLongmanMeanings(data) {
  const out = [];
  const wordList = data && data.longman && data.longman.wordList;
  if (!Array.isArray(wordList)) return out;
  for (const item of wordList) {
    const entry = item && item.Entry;
    if (!entry) continue;
    const head = Array.isArray(entry.Head) ? entry.Head[0] : null;
    const pos = head && head.POS ? String(head.POS) : '';
    for (const sense of entry.Sense || []) {
      const tran = Array.isArray(sense.TRAN) ? sense.TRAN : [];
      const defEn = Array.isArray(sense.DEF) ? sense.DEF : [];
      const definition = tran.length ? tran.join('；') : defEn.length ? defEn.join('; ') : '';
      if (!definition) continue;
      const exampleEn = Array.isArray(sense.EXAMPLE) ? sense.EXAMPLE : [];
      const exampleTran = Array.isArray(sense.EXAMPLETRAN) ? sense.EXAMPLETRAN : [];
      const example = exampleEn
        .map((en, i) => (exampleTran[i] ? en + ' / ' + exampleTran[i] : en))
        .join(' ')
        .slice(0, 320);
      out.push({
        partOfSpeech: pos,
        definitions: [{ definition, example, synonyms: Array.isArray(sense.SYN) ? sense.SYN.slice(0, 5) : [] }]
      });
    }
  }
  return out;
}

async function fetchWordDetail(word) {
  const d = await youdaoDictionary(word);
  const phonetic = d.usphone || d.ukphone || '';
  const hasContent = d.translations.length || d.meanings.length || d.examples.length || d.forms.length || phonetic;
  if (!hasContent) throw new Error('未获取到词典数据');
  return {
    phonetic,
    usphone: d.usphone,
    ukphone: d.ukphone,
    translations: d.translations,
    meanings: d.meanings,
    examples: d.examples,
    forms: d.forms,
    phrases: d.phrases
  };
}

function isSingleWord(text) {
  return /^[^\s]{1,64}$/.test(text.trim());
}

async function handleTranslate(text) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('没有可翻译的文本');
  if (clean.length > 5000) throw new Error('选中文本过长，请缩小范围后重试');

  const settings = await getSettings();
  let result;
  if (settings.engine === 'auto') {
    result = await translateAuto(clean, settings.targetLang, settings);
  } else {
    result = await translateWithEngine(settings.engine, clean, settings.targetLang, settings);
  }

  result.isWord = isSingleWord(clean);
  return result;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'readmate-translate-selection',
      title: 'ReadMate 翻译选中内容',
      contexts: ['selection']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'readmate-translate-selection' && tab && tab.id != null) {
    sendToTab(tab.id, { type: 'TRANSLATE_SELECTION', text: info.selectionText });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      await chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_SELECTION' });
    }
  } catch (err) {
    // 页面未注入或不可访问时静默失败
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'TRANSLATE') {
    handleTranslate(message.text)
      .then((result) => {
        safeSendResponse(sendResponse, result);
        if (result.isWord && sender && sender.tab && sender.tab.id != null) {
          const word = String(message.text || '').trim();
          fetchWordDetail(word)
            .then((dictionary) => sendToTab(sender.tab.id, { type: 'DICTIONARY_RESULT', word, dictionary }))
            .catch(() => sendToTab(sender.tab.id, { type: 'DICTIONARY_RESULT', word, dictionary: null }));
        }
      })
      .catch((err) => safeSendResponse(sendResponse, { error: err && err.message ? err.message : '翻译失败' }));
    return true;
  }
  return false;
});
