const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('../background.js', 'utf8');

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  AbortController,
  URL,
  fetch: async () => {
    throw new Error('no fetch stub');
  },
  chrome: {
    storage: {
      sync: {
        get: (defaults, cb) => cb({ ...defaults })
      }
    },
    runtime: {
      onInstalled: { addListener: () => {} },
      onMessage: { addListener: () => {} },
      lastError: null
    },
    contextMenus: {
      removeAll: (cb) => cb && cb(),
      create: () => {},
      onClicked: { addListener: () => {} }
    },
    commands: { onCommand: { addListener: () => {} } },
    tabs: { query: async () => [], sendMessage: async () => {} }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'background.js' });

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data
  };
}

async function check(name, fn, expectError = false) {
  try {
    const result = await fn();
    console.log(expectError ? 'FAIL (未抛错)' : 'PASS', name, '=>', JSON.stringify(result));
  } catch (err) {
    console.log(expectError ? 'PASS (预期错误)' : 'FAIL', name, '=>', err.message);
  }
}

(async () => {
  sandbox.fetch = async () =>
    jsonResponse({
      errorCode: 0,
      type: 'EN2ZH_CN',
      translateResult: [[{ src: 'hello', tgt: '你好' }, { src: 'world', tgt: '世界' }]]
    });
  await check('有道翻译解析', () => sandbox.translateYoudao('hello world'));

  sandbox.fetch = async () =>
    jsonResponse([[['你好世界', 'hello world', null, null, 10]], null, 'en', null, null]);
  await check('Google 解析', () => sandbox.translateGoogle('hello world', 'zh-CN'));

  sandbox.fetch = async () =>
    jsonResponse({
      responseStatus: 200,
      responseData: { translatedText: '你好世界', detectedLanguage: 'en' }
    });
  await check('MyMemory 解析', () => sandbox.translateMyMemory('hello world', 'zh-CN'));

  sandbox.fetch = async () =>
    jsonResponse({
      responseStatus: 200,
      responseData: { translatedText: 'QUERY LENGTH LIMIT EXCEEDED' }
    });
  await check('MyMemory 错误兜底', () => sandbox.translateMyMemory('hello world', 'zh-CN'), true);

  const youdaoFixture = {
    simple: { word: [{ usphone: 'həˈloʊ', ukphone: 'həˈləʊ' }] },
    ec: {
      word: [
        {
          usphone: 'həˈloʊ',
          ukphone: 'həˈləʊ',
          trs: [
            { tr: [{ l: { i: ['int. 喂，你好（用于问候）；喂，你好（打电话时的招呼语）'] } }] },
            { tr: [{ l: { i: ['n. 招呼，问候'] } }] }
          ],
          wfs: [{ wf: { name: '复数', value: 'hellos' } }]
        }
      ]
    },
    phrs: {
      word: 'hello',
      phrs: [
        { phr: { headword: { l: { i: 'say hello' } }, trs: [{ tr: { l: { i: '打招呼；问好' } } }] } }
      ]
    },
    blng_sents_part: {
      'sentence-pair': [
        { sentence: 'Hello, how are you?', 'sentence-translation': '你好，你好吗？' }
      ]
    }
  };
  sandbox.fetch = async () => jsonResponse(youdaoFixture);
  await check('有道词典解析', () => sandbox.youdaoDictionary('hello'));
  await check('合并词典数据', () => sandbox.fetchWordDetail('hello'));
})();
