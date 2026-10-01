// Read character advances from the same PDF.js drawing operations as the canvas.
// Unsupported font modes retain PDF.js's native text layer.
export function collectGlyphs(operatorList, commonObjs, OPS, transform) {
  const identity = () => [1, 0, 0, 1, 0, 0];
  const point = (matrix, x, y) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
  const initial = () => ({ ctm: identity(), tm: identity(), x: 0, y: 0, lineX: 0, lineY: 0,
    size: 0, fontName: '', font: null, charSpacing: 0, wordSpacing: 0, hScale: 1, rise: 0, leading: 0, direction: 1 });
  let state = initial();
  const stack = [], glyphs = [];
  function save() { stack.push({ ...state, ctm: [...state.ctm], tm: [...state.tm] }); }
  function restore() { if (stack.length) state = stack.pop(); }
  function setFont(name, size) {
    state.fontName = name;
    state.direction = size < 0 ? -1 : 1;
    state.size = Math.abs(size);
    try { state.font = commonObjs.get(name); } catch { state.font = null; }
  }
  function move(x, y) { state.x = state.lineX += x; state.y = state.lineY += y; }
  function show(glyphArray) {
    const font = state.font;
    if (!Array.isArray(glyphArray) || !font || !state.size) return;
    const matrix = transform(state.ctm, state.tm);
    const fontUnit = state.size * (font.fontMatrix?.[0] ?? 0.001);
    let advance = 0;
    for (const glyph of glyphArray) {
      if (typeof glyph === 'number') {
        advance += (font.vertical ? 1 : -1) * glyph * state.size / 1000;
        continue;
      }
      const width = glyph.width * fontUnit;
      if (!font.vertical && !font.isType3Font && !font.isInvalidPDFjsFont && state.direction > 0 && Number.isFinite(width)) {
        const x = state.x + advance * state.hScale;
        const origin = point(matrix, x, state.y + state.rise);
        const end = point(matrix, x + width * state.hScale, state.y + state.rise);
        glyphs.push({ text: String(glyph.unicode || '').normalize('NFKC'), origin, end, fontName: state.fontName });
      }
      const spacing = (glyph.isSpace ? state.wordSpacing : 0) + state.charSpacing;
      advance += font.vertical ? width - spacing * state.direction : width + spacing * state.direction;
    }
    if (font.vertical) state.y -= advance;
    else state.x += advance * state.hScale * state.direction;
  }
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i], args = operatorList.argsArray[i] || [];
    switch (fn) {
      case OPS.save: save(); break;
      case OPS.restore: restore(); break;
      case OPS.transform: state.ctm = transform(state.ctm, args); break;
      case OPS.paintFormXObjectBegin: save(); if (args[0]) state.ctm = transform(state.ctm, args[0]); break;
      case OPS.paintFormXObjectEnd: restore(); break;
      case OPS.beginGroup: save(); if (args[0]?.matrix) state.ctm = transform(state.ctm, args[0].matrix); break;
      case OPS.endGroup: restore(); break;
      case OPS.beginText: state.tm = identity(); state.x = state.y = state.lineX = state.lineY = 0; break;
      case OPS.setFont: setFont(args[0], args[1]); break;
      case OPS.setGState:
        for (const entry of args[0] || []) if (entry[0] === 'Font') setFont(...entry[1]);
        break;
      case OPS.setCharSpacing: state.charSpacing = args[0]; break;
      case OPS.setWordSpacing: state.wordSpacing = args[0]; break;
      case OPS.setHScale: state.hScale = args[0] / 100; break;
      case OPS.setLeading: state.leading = -args[0]; break;
      case OPS.setTextRise: state.rise = args[0]; break;
      case OPS.setTextMatrix:
        state.tm = args.length === 6 ? [...args] : [...args[0]];
        state.x = state.y = state.lineX = state.lineY = 0;
        break;
      case OPS.moveText: move(args[0], args[1]); break;
      case OPS.setLeadingMoveText: state.leading = args[1]; move(args[0], args[1]); break;
      case OPS.nextLine: move(0, state.leading); break;
      case OPS.showText: show(args[0]); break;
      case OPS.nextLineShowText: move(0, state.leading); show(args[0]); break;
      case OPS.nextLineSetSpacingShowText:
        state.wordSpacing = args[0]; state.charSpacing = args[1]; move(0, state.leading); show(args[2]); break;
    }
  }
  return glyphs;
}

export function matchRun(item, glyphs) {
  if (!item.str || item.dir === 'ttb' || item.dir === 'rtl') return null;
  const origin = [item.transform[4], item.transform[5]];
  const height = Math.hypot(item.transform[2], item.transform[3]);
  const angle = Math.atan2(item.transform[1], item.transform[0]);
  const along = position => (position[0] - origin[0]) * Math.cos(angle) + (position[1] - origin[1]) * Math.sin(angle);
  const across = position => -(position[0] - origin[0]) * Math.sin(angle) + (position[1] - origin[1]) * Math.cos(angle);
  let start = -1, distance = Infinity;
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    if (glyph.fontName !== item.fontName || !glyph.text || !item.str.startsWith(glyph.text)) continue;
    const d = Math.hypot(glyph.origin[0] - origin[0], glyph.origin[1] - origin[1]);
    if (d < distance && d < Math.max(0.15, height * 0.03)) { start = i; distance = d; }
  }
  if (start < 0) return null;
  const positions = [];
  let cursor = start, offset = 0, lastEnd = 0;
  while (offset < item.str.length) {
    if (/\s/u.test(item.str[offset])) {
      let endOffset = offset + 1;
      while (endOffset < item.str.length && /\s/u.test(item.str[endOffset])) endOffset++;
      while (cursor < glyphs.length && /^\s+$/u.test(glyphs[cursor].text)) cursor++;
      const next = glyphs[cursor];
      const right = next && next.fontName === item.fontName && Math.abs(across(next.origin)) < height * 0.2
        ? along(next.origin) : item.width;
      positions.push({ text: item.str.slice(offset, endOffset), left: lastEnd, width: Math.max(0, right - lastEnd) });
      lastEnd = right; offset = endOffset;
      continue;
    }
    const glyph = glyphs[cursor++];
    if (!glyph || glyph.fontName !== item.fontName || !glyph.text || !item.str.startsWith(glyph.text, offset) || Math.abs(across(glyph.origin)) > height * 0.2) return null;
    const left = along(glyph.origin), right = along(glyph.end);
    if (!(right > left) || left < -0.1 || right > item.width + height * 0.2) return null;
    positions.push({ text: item.str.slice(offset, offset + glyph.text.length), left, width: right - left });
    lastEnd = right; offset += glyph.text.length;
  }
  return positions;
}

export async function refineTextLayer(page, layer, content, viewport, pdfjsLib) {
  const operators = await page.getOperatorList();
  const glyphs = collectGlyphs(operators, page.commonObjs, pdfjsLib.OPS, pdfjsLib.Util.transform);
  const byFont = new Map();
  for (const glyph of glyphs) {
    if (!byFont.has(glyph.fontName)) byFont.set(glyph.fontName, []);
    byFont.get(glyph.fontName).push(glyph);
  }
  const items = content.items.filter(item => typeof item.str === 'string');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let refined = 0;
  layer.textDivs.forEach((span, index) => {
    const item = items[index];
    if (!item || !span.isConnected) return;
    const positions = matchRun(item, byFont.get(item.fontName) || []);
    if (!positions) return;
    const css = getComputedStyle(span);
    context.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    const minFontSize = parseFloat(css.getPropertyValue('--min-font-size')) || 1;
    const scaleX = parseFloat(span.style.getPropertyValue('--scale-x')) || 1;
    const factor = viewport.scale * viewport.userUnit * minFontSize / scaleX;
    const fragment = document.createDocumentFragment();
    for (const position of positions) {
      const glyph = document.createElement('span');
      glyph.className = 'rm-glyph';
      glyph.textContent = position.text;
      const width = Math.max(0.01, context.measureText(position.text).width);
      glyph.style.left = position.left * factor + 'px';
      glyph.style.width = width + 'px';
      glyph.style.setProperty('--rm-glyph-scale-x', position.width * factor / width);
      fragment.appendChild(glyph);
    }
    span.style.width = item.width * factor + 'px';
    span.style.height = css.fontSize;
    span.replaceChildren(fragment);
    refined++;
  });
  return refined;
}
