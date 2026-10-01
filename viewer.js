import * as pdfjsLib from './lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');
const viewer = document.getElementById('viewer');
const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const completeWords = document.getElementById('completeWords');
if (completeWords) {
  // Viewer preference stays local and does not affect ordinary webpage selections.
  chrome.storage.local.get({ pdfCompleteWords: true }, stored => {
    completeWords.checked = stored.pdfCompleteWords;
  });
  completeWords.addEventListener('change', () => {
    chrome.storage.local.set({ pdfCompleteWords: completeWords.checked });
    document.dispatchEvent(new Event('selectionchange'));
  });
}
let loadId = 0;
let loadingTask = null;
let canvasTask = null;
let textTask = null;

async function openPdf(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    statusEl.textContent = '请选择 PDF 文件';
    return;
  }
  const id = ++loadId;
  canvasTask?.cancel();
  textTask?.cancel();
  const previousTask = loadingTask;
  loadingTask = null;
  window.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event('readmate-pdf-reset'));
  viewer.replaceChildren();
  statusEl.textContent = '正在加载 ' + file.name + '…';
  try {
    await previousTask?.destroy();
    if (id !== loadId) return;
    const data = new Uint8Array(await file.arrayBuffer());
    if (id !== loadId) return;
    loadingTask = pdfjsLib.getDocument({
      data, isEvalSupported: false,
      cMapUrl: chrome.runtime.getURL('lib/cmaps/'), cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL('lib/standard_fonts/'),
      wasmUrl: chrome.runtime.getURL('lib/wasm/'),
      iccUrl: chrome.runtime.getURL('lib/iccs/')
    });
    const pdf = await loadingTask.promise;
    if (id !== loadId) return;
    let unreadablePages = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (id !== loadId) return;
      statusEl.textContent = file.name + ' · 正在加载 ' + pageNumber + '/' + pdf.numPages + ' 页';
      const page = await pdf.getPage(pageNumber);
      if (id !== loadId) return;
      const base = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, Math.min(960, viewer.clientWidth - 32));
      const viewport = page.getViewport({ scale: availableWidth / base.width });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pageEl = document.createElement('div');
      pageEl.className = 'page';
      pageEl.style.width = viewport.width + 'px';
      pageEl.style.height = viewport.height + 'px';
      pageEl.style.setProperty('--total-scale-factor', viewport.scale * viewport.userUnit);
      pageEl.setAttribute('aria-label', '第 ' + pageNumber + ' 页');
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width * dpr);
      canvas.height = Math.ceil(viewport.height * dpr);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      pageEl.appendChild(canvas);
      viewer.appendChild(pageEl);
      canvasTask = page.render({
        canvasContext: canvas.getContext('2d'), viewport,
        transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0]
      });
      await canvasTask.promise;
      if (id !== loadId) return;
      const textContent = await page.getTextContent();
      if (id !== loadId) return;
      const textLayerEl = document.createElement('div');
      textLayerEl.className = 'textLayer';
      pageEl.appendChild(textLayerEl);
      // Match the bundled PDF.js font metrics, glyph widths and rotation.
      textTask = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerEl, viewport });
      await textTask.render();
      if (id !== loadId) return;
      window.ReadMatePdfText.attachLayer(textTask, textContent, textLayerEl);
      if (!textContent.items.some(item => typeof item.str === 'string' && item.str.trim())) {
        unreadablePages++;
        const notice = document.createElement('p');
        notice.className = 'page-notice';
        notice.textContent = '此页没有可提取的文字，可能是扫描图片；需要先进行 OCR。';
        pageEl.appendChild(notice);
      }
    }
    canvasTask = textTask = null;
    statusEl.textContent = file.name + ' · 共 ' + pdf.numPages + ' 页 · 选词 / 双击 / Alt+T 翻译' +
      (unreadablePages ? ' · ' + unreadablePages + ' 页需要 OCR' : '');
  } catch (err) {
    if (id !== loadId) return;
    statusEl.textContent = '加载失败：' + (err?.message || '未知错误');
    console.error(err);
  }
}

document.getElementById('openBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  void openPdf(fileInput.files?.[0]);
  fileInput.value = '';
});
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  void openPdf(e.dataTransfer?.files?.[0]);
});
const empty = document.createElement('div');
empty.className = 'empty';
empty.textContent = '打开或拖入 PDF，选中文字即可翻译。支持词典、朗读原文和生词收藏。';
viewer.appendChild(empty);
