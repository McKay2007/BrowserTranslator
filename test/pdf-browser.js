// A browser-only harness for the real PDF.js / DOM selection paths. It replaces
// extension APIs with local stubs; selected text is never sent to a remote service.
const messages = [];
const callbacks = [];
const listeners = [];
const localStore = { vocabulary: [] };
Object.assign(window.chrome ||= {}, {
  storage: {
    sync: { get: (defaults, callback) => callback(defaults) },
    local: {
      get: (defaults, callback) => callback({ ...defaults, ...localStore }),
      set: (value, callback) => { Object.assign(localStore, value); callback?.(); }
    }
  },
  runtime: {
    id: 'pdf-test', lastError: null,
    getURL: path => new URL('../' + path, location.href).href,
    onMessage: { addListener: fn => listeners.push(fn) },
    sendMessage: (message, callback) => { messages.push(message); callbacks.push(callback); }
  }
});
// Real browser input (rather than synthetic dblclick) can be checked manually.
document.addEventListener('dblclick', event => {
  setTimeout(() => {
    let output = document.getElementById('doubleClickResult');
    if (!output) {
      output = document.createElement('output');
      output.id = 'doubleClickResult';
      document.querySelector('.toolbar').appendChild(output);
    }
    output.textContent = JSON.stringify({ trusted: event.isTrusted, selected: getSelection().toString(), requested: messages.at(-1)?.text });
  }, 180);
});
window.addEventListener('load', async () => {
  if (new URLSearchParams(location.search).has('alignment')) return;
  const results = document.getElementById('testResults');
  const lines = [];
  function check(name, condition) {
    lines.push((condition ? 'PASS ' : 'FAIL ') + name);
    results.textContent = lines.join('\n');
    if (!condition) { results.dataset.failed = 'true'; throw new Error(name); }
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(fn) {
    for (let i = 0; i < 200; i++) { if (fn()) return; await pause(100); }
    throw new Error('Timeout: ' + document.getElementById('status').textContent);
  }
  function select(first, start, last = first, end = last.textContent.length) {
    first.scrollIntoView({ block: 'center' });
    const range = document.createRange();
    const startPoint = ReadMatePdfText.textPoint(first, start), endPoint = ReadMatePdfText.textPoint(last, end);
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  }
  function shortcut() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT', altKey: true, bubbles: true }));
  }
  try {
    const file = new File([makePdfFixture()], 'selection-fixture.pdf', { type: 'application/pdf' });
    const transfer = new DataTransfer(); transfer.items.add(file);
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer }));
    await until(() => document.getElementById('status').textContent.includes('共 3 页'));
    const pages = [...document.querySelectorAll('.page')];
    check('all pages rendered', pages.length === 3);
    const spans = [...pages[0].querySelectorAll('[data-rm-pdf-text]')];
    const hello = spans.find(span => span.textContent === 'Hello world.');
    check('text extracted with standard fonts', !!hello);
    const rect = hello.getBoundingClientRect(), pageRect = pages[0].getBoundingClientRect();
    const scale = parseFloat(pages[0].style.getPropertyValue('--total-scale-factor'));
    check('text baseline matches rendered PDF', Math.abs(rect.left - pageRect.left - 60 * scale) < 1 &&
      Math.abs(rect.bottom - pageRect.top - 52 * scale) < 5 * scale);
    check('text width matches font metrics', Math.abs(rect.width - 94.014 * scale) < 2);
    let selection = select(hello, 0, hello, 5);
    check('partial word, no extra characters', ReadMatePdfText.readSelection(selection) === 'Hello');
    const selectedRect = selection.getRangeAt(0).getBoundingClientRect();
    const pointRange = document.caretRangeFromPoint(selectedRect.left + selectedRect.width / 2, selectedRect.top + selectedRect.height / 2);
    check('hit testing lands on selected word', hello.contains(pointRange?.startContainer));
    shortcut();
    check('Alt+T sends exact selected text', messages.at(-1).text === 'Hello');
    const staleCallback = callbacks.at(-1);
    select(hello, 6, hello, 11); shortcut();
    const liveCallback = callbacks.at(-1);
    liveCallback({ translated: '世界', engine: 'Test', isWord: true });
    check('PDF single-word bubble uses a compact 280px card', bubble.offsetWidth <= 281 && bubble.classList.contains('rm-compact'));
    staleCallback({ translated: 'STALE', engine: 'Test', isWord: true });
    check('late response cannot overwrite new selection', lastResult.translated === '世界');
    listeners.forEach(fn => fn({ type: 'DICTIONARY_RESULT', word: 'world', dictionary: { translations: ['n. 世界'], usphone: 'wɜːrld' } }, {}, () => {}));
    check('PDF word dictionary received', lastDictionary?.usphone === 'wɜːrld');
    toggleSave();
    check('PDF vocabulary saved locally', localStore.vocabulary[0]?.word === 'world');
    const completeWords = document.getElementById('completeWords');
    const translation = spans.find(span => span.textContent === 'translation.');
    selection = select(translation, 0, translation, 9);
    check('two missing final letters are completed', ReadMatePdfText.readSelection(selection) === 'translation');
    check('visible selection matches completed input without punctuation', selection.toString() === 'translation');
    shortcut();
    check('translation request uses the completed word', messages.at(-1).text === 'translation');
    selection = select(translation, 0, translation, 10);
    check('one missing final letter is completed', ReadMatePdfText.readSelection(selection) === 'translation');
    const backwardsEnd = ReadMatePdfText.textPoint(translation, 9), backwardsStart = ReadMatePdfText.textPoint(translation, 0);
    selection.setBaseAndExtent(backwardsEnd.node, backwardsEnd.offset, backwardsStart.node, backwardsStart.offset);
    check('backwards drag completes the trailing edge', ReadMatePdfText.readSelection(selection) === 'translation' &&
      selection.anchorNode === ReadMatePdfText.textPoint(translation, 11).node && selection.focusOffset === 0);
    completeWords.checked = false;
    selection = select(translation, 0, translation, 9);
    check('completion can be disabled for exact fragments', ReadMatePdfText.readSelection(selection) === 'translati' && selection.toString() === 'translati');
    completeWords.checked = true;
    selection = select(translation, 0, translation, 5);
    check('long intentional fragments remain exact', ReadMatePdfText.readSelection(selection) === 'trans');
    selection = select(translation, 2, translation, 9);
    check('selection starting within a word remains exact', ReadMatePdfText.readSelection(selection) === 'anslati');
    const splitPrefix = spans.find(span => span.textContent === 'translati');
    selection = select(splitPrefix, 0);
    check('missing suffix in a different PDF text run is completed', ReadMatePdfText.readSelection(selection) === 'translation' && selection.toString() === 'translation');
    const italic = spans.find(span => span.textContent === 'translation');
    selection = select(italic, 0, italic, 9);
    check('italic font word completion', ReadMatePdfText.readSelection(selection) === 'translation');
    selection = select(translation, 0, translation, 9);
    document.dispatchEvent(new PointerEvent('pointerdown'));
    check('completion waits until mouse drag ends', ReadMatePdfText.readSelection(selection) === 'translati');
    document.dispatchEvent(new PointerEvent('pointerup'));
    check('completion resumes on release', ReadMatePdfText.readSelection(selection) === 'translation');
    const firstLine = spans.find(span => span.textContent === 'ReadMate PDF selection.');
    const secondLine = spans.find(span => span.textContent === 'Second line of the same paragraph.');
    const newParagraph = spans.find(span => span.textContent === 'New paragraph.');
    selection = select(firstLine, 9, secondLine, 11);
    check('cross-line selection keeps only selected portions', ReadMatePdfText.readSelection(selection) === 'PDF selection. Second line');
    shortcut();
    check('PDF sentence bubble stays within 360px', bubble.offsetWidth <= 361 && !bubble.classList.contains('rm-compact'));
    selection = select(firstLine, 0, newParagraph);
    check('paragraph separation preserved', ReadMatePdfText.readSelection(selection) === 'ReadMate PDF selection. Second line of the same paragraph.\n\nNew paragraph.');
    const international = spans.find(span => span.textContent.includes('international'));
    check('adjacent text fragments do not split a word', !!international &&
      ReadMatePdfText.readSelection(select(international, 0)) === 'international');
    const rotated = pages[1].querySelector('[data-rm-pdf-text]');
    const rr = rotated.getBoundingClientRect(), pr = pages[1].getBoundingClientRect();
    check('rotated page text layer within page', rr.left >= pr.left && rr.right <= pr.right && rr.top >= pr.top && rr.bottom <= pr.bottom);
    check('rotated page selection', ReadMatePdfText.readSelection(select(rotated, 0, rotated, 7)) === 'Rotated');
    check('scan/empty page shows OCR notice', !!pages[2].querySelector('.page-notice'));
    const outside = document.createRange(); outside.selectNodeContents(results);
    selection.removeAllRanges(); selection.addRange(outside);
    check('toolbar and other UI text excluded', ReadMatePdfText.readSelection(selection) === '');
    completeWords.checked = false;
    check('double-click word selection works without suffix completion',
      ReadMatePdfText.selectWordAt(hello.querySelectorAll('.rm-glyph')[1]) && selection.toString() === 'Hello');
    check('double-click word selection crosses font changes',
      ReadMatePdfText.selectWordAt(splitPrefix.querySelector('.rm-glyph')) && selection.toString() === 'translation');
    select(hello, 0, hello, 5); shortcut();
    const closedCallback = callbacks.at(-1);
    hideBubble();
    closedCallback({ translated: 'CLOSED', engine: 'Test', isWord: true });
    check('closed bubble stays closed after a late response', bubble.hasAttribute('hidden'));
    // Leave a visible selection for visual inspection of the page and glyph alignment.
    select(hello, 0, hello, 5);
    document.dispatchEvent(new Event('readmate-pdf-reset'));
    lines.push('ALL PASSED'); results.textContent = lines.join('\n');
  } catch (error) {
    results.dataset.failed = 'true';
    results.textContent = lines.join('\n') + '\nERROR: ' + error.message;
    console.error(error);
  }
});
