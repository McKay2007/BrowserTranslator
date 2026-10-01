// Local-only diagnostics: the sample and extracted geometry live in tmp/pdfs.
window.addEventListener('load', async () => {
  if (!new URLSearchParams(location.search).has('alignment')) return;
  const results = document.getElementById('testResults');
  try {
    const response = await fetch('../tmp/pdfs/alignment-sample.pdf');
    if (!response.ok) throw new Error('Missing local PDF sample');
    const transfer = new DataTransfer();
    transfer.items.add(new File([await response.arrayBuffer()], 'alignment-sample.pdf', { type: 'application/pdf' }));
    document.getElementById('completeWords').checked = false;
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer }));
    for (let i = 0; i < 600 && !document.getElementById('status').textContent.includes('共 '); i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const page = document.querySelector('.page');
    if (!page) throw new Error('PDF not rendered');
    const geometry = await (await fetch('../tmp/pdfs/page1-geometry.json')).json();
    const scale = parseFloat(page.style.getPropertyValue('--total-scale-factor'));
    const spans = [...page.querySelectorAll('[data-rm-pdf-text]')];
    const report = [];
    for (const word of geometry.words.filter(w => w.top < 450)) {
      let best = null;
      for (const span of spans) {
        if (!span.firstChild) continue;
        for (let index = span.textContent.indexOf(word.text); index >= 0; index = span.textContent.indexOf(word.text, index + 1)) {
        const range = document.createRange();
        range.setStart(span.firstChild, index);
        range.setEnd(span.firstChild, index + word.text.length);
        const rect = range.getBoundingClientRect(), pageRect = page.getBoundingClientRect();
        const left = (rect.left - pageRect.left) / scale;
        const right = (rect.right - pageRect.left) / scale;
        const yError = (rect.top + rect.height / 2 - pageRect.top) / scale - (word.top + word.bottom) / 2;
        if (Math.abs(yError) > 8 || Math.abs(left - word.x0) > 35) continue;
        const score = Math.abs(yError) * 10 + Math.abs(left - word.x0) + Math.abs(right - word.x1);
        const entry = { word: word.text, line: Math.round(word.top),
          leftError: +(left - word.x0).toFixed(2), rightError: +(right - word.x1).toFixed(2),
          font: span.style.fontFamily, run: span.textContent };
        if (!best || score < best.score) best = { score, entry };
        }
      }
      if (best) report.push(best.entry);
    }
    results.textContent = JSON.stringify({ matchedWords: report.length,
      worst: report.toSorted((a, b) => Math.max(Math.abs(b.leftError), Math.abs(b.rightError)) - Math.max(Math.abs(a.leftError), Math.abs(a.rightError))).slice(0, 25),
      title: report.slice(0, 10), runs: spans.slice(0, 22).map(span => ({ text: span.textContent, font: span.style.fontFamily, scaleX: span.style.getPropertyValue('--scale-x') }))
    }, null, 2);
    results.style.maxHeight = '200px'; results.style.overflow = 'auto';
  } catch (error) { results.textContent = 'ERROR: ' + error.message; }
});
