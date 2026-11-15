// iconFor: lowercases, strips punctuation/numbers, returns null for unknown or empty words.
const test = require('node:test');
const assert = require('node:assert');
const { iconFor } = require('../src/renderer/icons.js');

test('exact word, any case', () => {
  assert.strictEqual(iconFor('love'), '❤️');
  assert.strictEqual(iconFor('LOVE'), '❤️');
  assert.strictEqual(iconFor('Notte'), '🌙');
});

test('italian words map like their english twins', () => {
  assert.strictEqual(iconFor('cuore'), iconFor('heart'));
  assert.strictEqual(iconFor('sole'), iconFor('sun'));
  assert.strictEqual(iconFor('mare'), iconFor('sea'));
});

test('surrounding punctuation is stripped before lookup', () => {
  assert.strictEqual(iconFor('love!'), '❤️');
  assert.strictEqual(iconFor('(moon)'), '🌙');
  assert.strictEqual(iconFor('fire2'), '🔥');
});

test('unknown and empty words give no icon', () => {
  assert.strictEqual(iconFor('zqwxkv'), null);
  assert.strictEqual(iconFor(''), null);
  assert.strictEqual(iconFor(null), null);
  assert.strictEqual(iconFor('!!!'), null);
});
