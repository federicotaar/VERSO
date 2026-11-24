// findActiveLine: the current line is the last one that started.
const assert = require('assert');
const { findActiveLine } = require('../src/lyrics/active');

const lines = [
  { startMs: 10000, endMs: 14500, text: 'one' },
  { startMs: 14500, endMs: 20000, text: 'two' },
  { startMs: 30000, endMs: 35000, text: 'three' },
];

assert.strictEqual(findActiveLine(lines, 0), -1);
assert.strictEqual(findActiveLine(lines, 9999), -1);
assert.strictEqual(findActiveLine(lines, 10000), 0);
assert.strictEqual(findActiveLine(lines, 14499), 0);
// boundary: the next line starts exactly at the previous end
assert.strictEqual(findActiveLine(lines, 14500), 1);
// instrumental gap between line 1 and 2: the previous line stays current
assert.strictEqual(findActiveLine(lines, 25000), 1);
assert.strictEqual(findActiveLine(lines, 30000), 2);
assert.strictEqual(findActiveLine(lines, 999999), 2);
// defensive: empty/garbage input never throws
assert.strictEqual(findActiveLine([], 1000), -1);
assert.strictEqual(findActiveLine(null, 1000), -1);
assert.strictEqual(findActiveLine(lines, NaN), -1);
// large model stays correct (binary search, not a scan)
const big = Array.from({ length: 500 }, (_, i) => ({ startMs: i * 3000, endMs: i * 3000 + 2500, text: 'l' + i }));
assert.strictEqual(findActiveLine(big, 499 * 3000), 499);
assert.strictEqual(findActiveLine(big, 10 * 3000 + 1), 10);

const { findNextLine } = require('../src/lyrics/active');
assert.strictEqual(findNextLine(lines, 0), 0);
assert.strictEqual(findNextLine(lines, 10000), 1);
assert.strictEqual(findNextLine(lines, 25000), 2);
assert.strictEqual(findNextLine(lines, 30000), -1);
assert.strictEqual(findNextLine([], 5), -1);
assert.strictEqual(findNextLine(lines, NaN), -1);

const { lineProgress } = require('../src/lyrics/active');
assert.strictEqual(lineProgress(lines[0], 9000), 0);
assert.strictEqual(lineProgress(lines[0], 12250), 0.5);
assert.strictEqual(lineProgress(lines[0], 20000), 1);
assert.strictEqual(lineProgress({ startMs: 5, endMs: 5 }, 6), 1);
assert.strictEqual(lineProgress(null, 6), 0);
assert.strictEqual(lineProgress(lines[0], NaN), 0);

console.log('ACTIVE-LINE TESTS PASS');
