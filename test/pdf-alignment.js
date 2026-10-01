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
        const start = ReadMatePdfText.textPoint(span, index), end = ReadMatePdfText.textPoint(span, index + word.text.length);
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
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
    const hitTests = [];
    const toolbar = document.querySelector('.toolbar');
    for (const word of geometry.words.filter(w => /^[A-Za-z][A-Za-z-]{3,}$/.test(w.text) && w.top > 155 && w.top < 440).slice(0, 100)) {
      const pageRect = page.getBoundingClientRect();
      const y = pageRect.top + (word.top + word.bottom) / 2 * scale;
      if (y < toolbar.getBoundingClientRect().bottom + 4 || y >= innerHeight - 4) continue;
      const first = document.caretRangeFromPoint(pageRect.left + (word.x0 + 0.12) * scale, y);
      const last = document.caretRangeFromPoint(pageRect.left + (word.x1 - 0.12) * scale, y);
      if (!first || !last || !page.contains(first.startContainer) || !page.contains(last.startContainer)) {
        hitTests.push({ expected: word.text, actual: '(no text hit)' }); continue;
      }
      const range = document.createRange();
      range.setStart(first.startContainer, first.startOffset);
      range.setEnd(last.startContainer, last.startOffset);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const actual = ReadMatePdfText.readSelection(selection);
      hitTests.push({ expected: word.text, actual });
    }
    const ordinaryWords = report.filter(w => /[A-Za-z]{2}/.test(w.word));
    results.textContent = JSON.stringify({ matchedWords: report.length,
      maxOrdinaryWordError: Math.max(...ordinaryWords.flatMap(w => [Math.abs(w.leftError), Math.abs(w.rightError)])),
      refinedRuns: page.querySelectorAll('[data-rm-pdf-text]:has(.rm-glyph)').length,
      hitTests: { passed: hitTests.filter(t => t.actual === t.expected).length, total: hitTests.length,
        failed: hitTests.filter(t => t.actual !== t.expected) },
      worst: report.toSorted((a, b) => Math.max(Math.abs(b.leftError), Math.abs(b.rightError)) - Math.max(Math.abs(a.leftError), Math.abs(a.rightError))).slice(0, 25),
      title: report.slice(0, 10), runs: spans.slice(0, 22).map(span => ({ text: span.textContent, font: span.style.fontFamily, scaleX: span.style.getPropertyValue('--scale-x') }))
    }, null, 2);
    results.style.maxHeight = '200px'; results.style.overflow = 'auto';
  } catch (error) { results.textContent = 'ERROR: ' + error.message; }
});
