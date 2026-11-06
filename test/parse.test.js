const assert = require('assert');
const { parseLrc } = require('../src/lyrics/lrcparse');
const { estimateWords } = require('../src/lyrics/estimate');
const { parseTtml } = require('../src/lyrics/ttml');

// standard LRC
const lrc = '[00:10.00]hello world\n[00:14.50]second line here\n[00:20.00]third';
let m = parseLrc(lrc);
assert.strictEqual(m.lines.length, 3);
assert.strictEqual(m.lines[0].startMs, 10000);
assert.strictEqual(m.lines[0].endMs, 14500);
assert.strictEqual(m.lines[1].text, 'second line here');
assert.strictEqual(m.lines[0].words, null);

// estimate words on line-level model
estimateWords(m.lines);
assert.ok(m.lines[0].words && m.lines[0].words.length === 2);
assert.strictEqual(m.lines[0].estimated, true);
assert.ok(m.lines[0].words[0].startMs === 10000);
assert.ok(m.lines[0].words[1].endMs <= 14500);
assert.ok(m.lines.every(l => l.words.every(w => w.startMs < w.endMs)), 'word order');

// enhanced LRC with word tags
const elrc = '[00:01.00]<00:01.00>hel<00:01.40>lo <00:02.00>world\n[00:05.00]next';
m = parseLrc(elrc);
assert.strictEqual(m.lines[0].text, 'hello world');
assert.strictEqual(m.lines[0].words.length, 3);
assert.strictEqual(m.lines[0].words[0].endMs, 1400);
assert.strictEqual(m.lines[0].words[2].endMs, 5000);

// TTML word timings
const ttml = `<tt><body><div><p begin="00:00:10.000" end="00:00:12.000"><span begin="00:00:10.000" end="00:00:10.500">hel</span><span begin="00:00:10.500" end="00:00:11.000">lo </span><span begin="00:00:11.200" end="00:00:11.900">world</span></p><p begin="00:00:13.000" end="00:00:14.000"><span begin="00:00:13.000" end="00:00:14.000">next</span></p></div></body></tt>`;
m = parseTtml(ttml);
assert.strictEqual(m.lines.length, 2);
assert.strictEqual(m.lines[0].text, 'hello world');
assert.strictEqual(m.lines[0].words[2].startMs, 11200);
assert.strictEqual(m.lines[1].words[0].endMs, 14000);

// icons mapping original asset loads
const { iconFor } = require('../src/renderer/icons');
assert.strictEqual(iconFor('amore'), '❤️');
assert.strictEqual(iconFor('zzzznope'), null);


// repeated-chorus LRC: several timestamps on one line each produce a line
m = parseLrc('[ar:Someone]\r\n[00:10.00][00:50.00]chorus\r\n[00:20.00]verse\r\n[01:05.5]end');
assert.deepStrictEqual(m.lines.map(l => [l.startMs, l.text]), [[10000, 'chorus'], [20000, 'verse'], [50000, 'chorus'], [65500, 'end']]);
assert.strictEqual(m.lines[0].endMs, 20000);
assert.strictEqual(m.lines[2].endMs, 65500);
// metadata tags and blank lyric lines never become lyric text
assert.ok(!m.lines.some(l => /ar:/.test(l.text)));
assert.strictEqual(parseLrc('[00:01.00]\n[00:02.00]x').lines.length, 1);
// enhanced word tags shift with each repeated timestamp
m = parseLrc('[00:01.00][00:11.00]<00:01.00>a <00:01.50>b\n[00:20.00]z');
assert.strictEqual(m.lines[1].startMs, 11000);
assert.strictEqual(m.lines[1].words[1].startMs, 11500);

console.log('ALL TESTS PASS');
