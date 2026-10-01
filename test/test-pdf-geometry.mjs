import assert from 'node:assert/strict';
import { collectGlyphs, matchRun } from '../pdf-text-geometry.js';

const names = ['save', 'restore', 'transform', 'paintFormXObjectBegin', 'paintFormXObjectEnd',
  'beginGroup', 'endGroup', 'beginText', 'setFont', 'setGState', 'setCharSpacing', 'setWordSpacing',
  'setHScale', 'setLeading', 'setTextRise', 'setTextMatrix', 'moveText', 'setLeadingMoveText',
  'nextLine', 'showText', 'nextLineShowText', 'nextLineSetSpacingShowText'];
const OPS = Object.fromEntries(names.map((name, i) => [name, i]));
function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
const fonts = { regular: { fontMatrix: [0.001,0,0,0.001,0,0] },
  vertical: { fontMatrix: [0.001,0,0,0.001,0,0], vertical: true },
  type3: { fontMatrix: [0.001,0,0,0.001,0,0], isType3Font: true } };
const chars = text => [...text].map(unicode => ({ unicode, width: unicode === ' ' ? 250 : 600, isSpace: unicode === ' ' }));
function read(operations) {
  return collectGlyphs({ fnArray: operations.map(([name]) => OPS[name]), argsArray: operations.map(([, ...args]) => args) },
    { get: name => fonts[name] }, OPS, multiply);
}
const setup = [['beginText'], ['setFont', 'regular', 10], ['setTextMatrix', [1,0,0,1,10,700]]];
const justified = read([...setup, ['showText', [...chars('one'), -800, ...chars('two')]]]);
assert.deepEqual(justified.map(g => g.origin[0]), [10,16,22,36,42,48]);
const item = { str: 'one two', fontName: 'regular', transform: [10,0,0,10,10,700], width: 44, dir: 'ltr' };
const run = matchRun(item, justified);
assert.equal(run.map(g => g.text).join(''), 'one two');
assert.deepEqual(run.map(g => [g.left, g.width]), [[0,6],[6,6],[12,6],[18,8],[26,6],[32,6],[38,6]]);
console.log('PASS justified TJ word gap preserves exact letter positions');

const spacing = read([...setup, ['setCharSpacing', 1], ['setWordSpacing', 3], ['setHScale', 80], ['showText', chars('a b')]]);
assert.deepEqual(spacing.map(g => +g.origin[0].toFixed(2)), [10,15.6,20.8]);
assert.equal(+(spacing[0].end[0] - spacing[0].origin[0]).toFixed(2), 4.8);
console.log('PASS character spacing, word spacing and horizontal scale');

const state = read([...setup, ['save'], ['transform', 2,0,0,2,30,40], ['showText', chars('a')],
  ['restore'], ['showText', chars('b')], ['setLeading', 12], ['nextLine'], ['showText', chars('c')]]);
assert.deepEqual(state.map(g => g.origin), [[50,1440],[10,700],[10,688]]);
console.log('PASS graphics-state restore and line leading');

const rotated = read([['beginText'], ['setFont','regular',10], ['setTextMatrix',[0,1,-1,0,50,60]], ['showText',chars('ab')]]);
assert.deepEqual(rotated.map(g => g.origin), [[50,60],[50,66]]);
assert.deepEqual(matchRun({ ...item, str:'ab', transform:[0,10,-10,0,50,60], width:12 }, rotated).map(g => g.left), [0,6]);
console.log('PASS rotated text projects along its own baseline');

assert.equal(matchRun({ ...item, str:'wrong' }, justified), null);
assert.equal(matchRun({ ...item, dir:'rtl' }, justified), null);
assert.equal(read([['setFont','vertical',10],['showText',chars('ab')]]).length, 0);
assert.equal(read([['setFont','type3',10],['showText',chars('ab')]]).length, 0);
console.log('PASS unmatched text and unsupported font modes keep the native layer');
