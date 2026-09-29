const fs = require('fs');
const vm = require('vm');

class FakeEl {
  constructor() {
    this.style = {};
    this._hidden = true;
    this.textContent = '';
    this._innerHTML = '';
    this.children = [];
    this.handlers = {};
    this.offsetWidth = 480;
    this.offsetHeight = 160;
    this._qCache = new Map();
    this.classList = {
      _set: new Set(),
      add: (c) => this.classList._set.add(c),
      remove: (c) => this.classList._set.delete(c),
      contains: (c) => this.classList._set.has(c)
    };
  }
  set innerHTML(v) { this._innerHTML = v; }
  get innerHTML() { return this._innerHTML; }
  setAttribute(k, v) { if (k === 'hidden') this._hidden = true; }
  removeAttribute(k) { if (k === 'hidden') this._hidden = false; }
  hasAttribute(k) { return k === 'hidden' ? this._hidden : false; }
  appendChild(c) { this.children.push(c); return c; }
  attachShadow() { this.shadowRoot = new FakeEl(); return this.shadowRoot; }
  querySelector(sel) {
    if (!this._qCache.has(sel)) this._qCache.set(sel, new FakeEl());
    return this._qCache.get(sel);
  }
  addEventListener(type, fn) { this.handlers[type] = fn; }
  removeEventListener() {}
  getBoundingClientRect() { return { left: 10, top: 50, right: 120, bottom: 72, width: 110, height: 22 }; }
  setPointerCapture() {}
}

const rangeState = { left: 10, top: 50, right: 120, bottom: 72, width: 110, height: 22 };
const rangeObj = { getBoundingClientRect: () => ({ ...rangeState }) };
const selection = {
  text: 'hello world',
  toString: () => selection.text,
  getRangeAt: () => rangeObj
};

const documentEl = new FakeEl();
const bodyEl = new FakeEl();
const docHandlers = {};
const localStore = { vocabulary: [] };

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  document: {
    documentElement: documentEl,
    body: bodyEl,
    getElementById: () => null,
    createElement: () => new FakeEl(),
    addEventListener: (type, fn) => { docHandlers[type] = fn; },
    removeEventListener: () => {},
    execCommand: () => true
  },
  window: {
    innerWidth: 1280,
    innerHeight: 800,
    getSelection: () => selection,
    speechSynthesis: { cancel: () => {}, speak: () => {} }
  },
  navigator: { clipboard: { writeText: async () => {} } },
  SpeechSynthesisUtterance: function () { this.lang = ''; },
  chrome: {
    storage: {
      sync: { get: (defaults, cb) => cb(defaults), set: (v, cb) => cb && cb() },
      local: {
        get: (defaults, cb) => cb({ ...defaults, ...localStore }),
        set: (v, cb) => { Object.assign(localStore, v); cb && cb(); }
      }
    },
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: (msg, cb) => cb({ translated: '你好', engine: '测试', isWord: true }),
      lastError: null
    }
  }
};

vm.createContext(sandbox);
const code = fs.readFileSync('../content.js', 'utf8');
vm.runInContext(code, sandbox, { filename: 'content.js' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

function assert(name, cond) {
  if (cond) {
    console.log('PASS', name);
  } else {
    console.log('FAIL', name);
    failures++;
  }
}

(async () => {
  const host = documentEl.children[0];
  const shadow = host.shadowRoot;
  const btn = shadow.children[1];
  const bubble = shadow.children[2];

  // 1. 划词后按钮出现
  docHandlers.mouseup();
  await sleep(200);
  assert('划词后按钮出现', btn.hasAttribute('hidden') === false);

  // 1.1 文本仍在视口内滚动时，按钮跟随移动
  rangeState.left = 200;
  rangeState.right = 310;
  rangeState.top = 300;
  rangeState.bottom = 322;
  docHandlers.scroll();
  assert('按钮随滚动跟随移动', btn.style.left === '316px' && btn.style.top === '266px');

  // 2. 点击按钮翻译，弹窗出现、按钮隐藏
  rangeState.left = 10;
  rangeState.right = 120;
  rangeState.top = 50;
  rangeState.bottom = 72;
  btn.handlers.click();
  assert('翻译后气泡出现', bubble.hasAttribute('hidden') === false);
  assert('翻译后按钮隐藏', btn.hasAttribute('hidden') === true);

  // 2.1 文本在视口内滚动时，弹窗跟随移动
  rangeState.left = 200;
  rangeState.right = 310;
  rangeState.top = 300;
  rangeState.bottom = 322;
  docHandlers.scroll();
  assert('弹窗随滚动跟随移动', bubble.style.left === '200px' && bubble.style.top === '330px');

  // 3. 关闭按钮隐藏弹窗，同时隐藏按钮
  bubble.removeAttribute('hidden');
  const closeBtn = bubble.querySelector('.rm-close');
  assert('关闭按钮绑定了 pointerdown 阻止冒泡', typeof closeBtn.handlers.pointerdown === 'function');
  closeBtn.handlers.click();
  assert('点击关闭按钮后气泡隐藏', bubble.hasAttribute('hidden') === true);

  // 4. 选中文本滚出视口时，弹窗与按钮一起关闭
  docHandlers.mouseup();
  await sleep(200);
  bubble.removeAttribute('hidden');
  rangeState.top = -1000;
  rangeState.bottom = -900;
  docHandlers.scroll();
  assert('文本滚出视口后自动关闭', bubble.hasAttribute('hidden') === true);
  assert('文本滚出视口后按钮一并隐藏', btn.hasAttribute('hidden') === true);

  // 5. 文本仍在视口内时不关闭
  docHandlers.mouseup();
  await sleep(200);
  rangeState.top = 50;
  rangeState.bottom = 72;
  bubble.removeAttribute('hidden');
  docHandlers.scroll();
  assert('文本仍在视口内时保持显示', bubble.hasAttribute('hidden') === false);

  // 6. 生词本收藏
  const saveBtn = bubble.querySelector('.rm-save');
  docHandlers.mouseup();
  await sleep(200);
  btn.handlers.click();
  assert('选中单词时收藏按钮出现', saveBtn.hasAttribute('hidden') === false);
  saveBtn.handlers.click();
  assert('点击后加入生词本', localStore.vocabulary.some((v) => v.word === 'hello world'));
  assert('收藏后按钮变为已收藏', saveBtn.textContent === '★ 已收藏');
  saveBtn.handlers.click();
  assert('再次点击移出生词本', !localStore.vocabulary.some((v) => v.word === 'hello world'));
  assert('取消后按钮恢复为收藏', saveBtn.textContent === '☆ 收藏');

  process.exitCode = failures ? 1 : 0;
  console.log(failures ? '有失败用例' : '全部通过');
})();
