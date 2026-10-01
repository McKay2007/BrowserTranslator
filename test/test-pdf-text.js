const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pdf-selection.js'), 'utf8'), sandbox);
const { normalize } = sandbox.window.ReadMatePdfText;
for (const [name, input, expected] of [
  ['跨行句子', 'A PDF line\ncontinues here.', 'A PDF line continues here.'],
  ['段落边界', 'First line\ncontinues.\n\nNext paragraph.', 'First line continues.\n\nNext paragraph.'],
  ['软连字符断词', 'trans\u00ad\nlation', 'translation'],
  ['保留实际连字符', 'well-\nknown', 'well-known'],
  ['字体连字', 'e\ufb03cient \ufb01le \ufb02ow', 'efficient file flow'],
  ['不可见字符与不换行空格', 'hello\u00a0\u200bworld\ufeff', 'hello world'],
  ['中文跨行不加空格', '中文\n翻译', '中文翻译'],
  ['公式和数字保留', 'x = 1.25\n+ y', 'x = 1.25 + y'],
  ['保留兼容符号', 'H₂O ① ㎏', 'H₂O ① ㎏'],
  ['空选择', '', '']
]) {
  assert.equal(normalize(input), expected, name);
  console.log('PASS', name);
}

const { completionEnd } = sandbox.window.ReadMatePdfText;
for (const [name, text, start, end, expected] of [
  ['补齐 translation 末尾两个字母', 'translation', 0, 9, 11],
  ['补齐 translation 末尾一个字母', 'translation', 0, 10, 11],
  ['句末单词补齐', 'A good translation.', 0, 16, 18],
  ['完整单词保持原样', 'translation', 0, 11, 11],
  ['不补齐长词片段', 'international', 0, 5, 5],
  ['不扩展词中开始的片段', 'translation', 2, 9, 9],
  ['不扩展只有一两个字母的片段', 'word', 0, 2, 2],
  ['不跨越空格追加下一个词', 'Hello world', 0, 5, 5],
  ['不扩展数字标识符', 'abc12', 0, 2, 2],
  ['不扩展下划线标识符', 'some_value', 5, 8, 8],
  ['中文不自动扩展', '中文翻译', 0, 3, 3]
]) {
  assert.equal(completionEnd(text, start, end), expected, name);
  console.log('PASS', name);
}
