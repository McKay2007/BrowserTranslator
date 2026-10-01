// Only loaded in the extension's PDF viewer; ordinary webpages retain their text.
(() => {
  const metadata = new WeakMap();
  let draggingSelection = false;
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => { draggingSelection = true; });
    document.addEventListener('pointerup', () => { draggingSelection = false; });
    document.addEventListener('pointercancel', () => { draggingSelection = false; });
    window.addEventListener('blur', () => { draggingSelection = false; });
  }

  function normalize(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u00a0\u202f]/g, ' ')
      .replace(/[\u200b\ufeff]/g, '')
      .replace(/\u00ad[ \t]*\n[ \t]*/g, '')
      .replace(/\u00ad/g, '')
      .replace(/[\ufb00-\ufb06]/g, c => ({
        '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi',
        '\ufb04': 'ffl', '\ufb05': 'st', '\ufb06': 'st'
      })[c])
      // Preserve real hyphens (well-known, identifiers); remove only the line break.
      .replace(/([\p{L}\p{N}])-[ \t]*\n[ \t]*(?=[\p{L}\p{N}])/gu, '$1-')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/([^\n])\n(?!\n)/g, '$1 ')
      .replace(/[ \t]+/g, ' ')
      .replace(/([\u3400-\u9fff\u3040-\u30ff]) +(?=[\u3400-\u9fff\u3040-\u30ff])/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function attachLayer(layer, content, container) {
    const items = content.items.filter(item => typeof item.str === 'string');
    layer.textDivs.forEach((span, index) => {
      const item = items[index];
      if (item) metadata.set(span, { item, container });
      span.dataset.rmPdfText = '';
    });
  }

  function separator(previous, next) {
    if (previous.container !== next.container) return '\n\n';
    const a = previous.item, b = next.item;
    const angle = Math.atan2(a.transform[1], a.transform[0]);
    const dx = b.transform[4] - a.transform[4];
    const dy = b.transform[5] - a.transform[5];
    const height = Math.max(Math.hypot(a.transform[2], a.transform[3]),
      Math.hypot(b.transform[2], b.transform[3]), 1);
    const lineDistance = Math.abs(-Math.sin(angle) * dx + Math.cos(angle) * dy);
    if (lineDistance > height * 1.8) return '\n\n';
    if (a.hasEOL || lineDistance > height * 0.5) return '\n';
    const gap = Math.cos(angle) * dx + Math.sin(angle) * dy - a.width;
    if (gap > height * 4) return '\n\n';
    return gap > height * 0.15 ? ' ' : '';
  }

  function completionEnd(text, start, end) {
    // Only complete a mostly selected Latin word with a one/two-letter suffix.
    // Long partial words, selections starting inside a word, numbers and identifiers
    // stay exact. This is a bounded fallback for imperfect PDF character advances.
    for (const match of text.matchAll(/[\p{Script=Latin}\p{M}]+(?:['’][\p{Script=Latin}\p{M}]+)*/gu)) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;
      if (end <= wordStart || end >= wordEnd) continue;
      const suffix = Array.from(text.slice(end, wordEnd));
      if (start > wordStart || end - wordStart < 3 || suffix.length > 2) return end;
      if (/[\p{N}_]/u.test(text[wordStart - 1] || '') || /[\p{N}_]/u.test(text[wordEnd] || '')) return end;
      if (!/^[\p{Script=Latin}\p{M}]+$/u.test(suffix.join(''))) return end;
      return wordEnd;
    }
    return end;
  }

  function completeRangeEnd(range, spans) {
    if (range.collapsed || range.endContainer.nodeType !== 3) return range;
    const endSpan = range.endContainer.parentElement;
    const index = spans.indexOf(endSpan);
    if (index < 0 || endSpan.firstChild !== range.endContainer) return range;
    // A PDF word can be split across multiple text runs (font changes or kerning).
    let first = index, last = index;
    const connected = (a, b) => {
      const left = metadata.get(a), right = metadata.get(b);
      return left && right && separator(left, right) === '';
    };
    while (first > 0 && connected(spans[first - 1], spans[first])) first--;
    while (last + 1 < spans.length && connected(spans[last], spans[last + 1])) last++;
    const run = spans.slice(first, last + 1);
    let text = '', start = 0, end = 0;
    for (const span of run) {
      if (span.firstChild === range.startContainer) start = text.length + range.startOffset;
      if (span === endSpan) end = text.length + range.endOffset;
      text += span.textContent;
    }
    const completed = completionEnd(text, start, end);
    if (completed === end) return range;
    const corrected = range.cloneRange();
    let offset = completed;
    for (const span of run) {
      if (offset <= span.textContent.length && span.firstChild) {
        corrected.setEnd(span.firstChild, offset);
        return corrected;
      }
      offset -= span.textContent.length;
    }
    return range;
  }

  function readSelection(selection) {
    if (!selection || !selection.rangeCount) return '';
    let range = selection.getRangeAt(0);
    const viewer = document.getElementById('viewer');
    if (!viewer || !viewer.contains(range.startContainer) || !viewer.contains(range.endContainer)) return '';
    const spans = Array.from(viewer.querySelectorAll('[data-rm-pdf-text]'));
    if (!draggingSelection && document.getElementById('completeWords')?.checked !== false) {
      const corrected = completeRangeEnd(range, spans);
      if (corrected !== range) {
        // Keep the visible highlight and the actual translation input consistent,
        // including backwards drags whose focus is at the start of the range.
        const backward = selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset;
        if (selection.setBaseAndExtent) {
          selection.setBaseAndExtent(
            backward ? corrected.endContainer : corrected.startContainer,
            backward ? corrected.endOffset : corrected.startOffset,
            backward ? corrected.startContainer : corrected.endContainer,
            backward ? corrected.startOffset : corrected.endOffset
          );
        } else {
          selection.removeAllRanges();
          selection.addRange(corrected);
        }
        range = corrected;
      }
    }
    let text = '', previous = null;
    for (const span of spans) {
      if (!range.intersectsNode(span)) continue;
      const info = metadata.get(span);
      if (!info) continue;
      const part = document.createRange();
      part.selectNodeContents(span);
      if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) {
        part.setStart(range.startContainer, range.startOffset);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) {
        part.setEnd(range.endContainer, range.endOffset);
      }
      const selected = part.toString();
      if (!selected) continue;
      if (previous) text += separator(previous, info);
      text += selected;
      previous = info;
    }
    return normalize(text);
  }

  window.ReadMatePdfText = { normalize, attachLayer, readSelection, completionEnd };
})();
