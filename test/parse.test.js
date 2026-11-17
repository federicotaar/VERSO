const assert = require('assert');
const { parseLrc, tsToMs } = require('../src/lyrics/lrcparse');
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


// LRC metadata/ID tags ([ti:], [ar:], [offset:]...) must not become lyric
// lines and must not disturb the timing of real lines.
{
  const withTags = '[ti:Song Title]\n[ar:Artist]\n[offset:+500]\n[00:03.00]real line\n[00:06.00]next';
  const parsed = parseLrc(withTags);
  assert.strictEqual(parsed.lines.length, 2, 'ID tags must be skipped');
  assert.strictEqual(parsed.lines[0].text, 'real line');
  assert.strictEqual(parsed.lines[0].startMs, 2500, 'offset applies, other tags do not disturb timing');
  assert.strictEqual(parsed.lines[1].endMs, 10500, 'last line keeps the 5s tail');
  console.log('ID tag handling OK');
}

console.log('ALL TESTS PASS');


// [offset:] shifts every timestamp: + makes lyrics appear sooner
{
  const parsed = parseLrc('[offset:+500]\n[00:03.00]line one\n[00:06.00]line two');
  assert.strictEqual(parsed.lines[0].startMs, 2500);
  assert.strictEqual(parsed.lines[1].startMs, 5500);
  const neg = parseLrc('[offset:-1000]\n[00:03.00]line');
  assert.strictEqual(neg.lines[0].startMs, 4000);
  console.log('offset handling OK');
}


// tsToMs handles long minute fields and rounds fractional seconds
{
  assert.strictEqual(tsToMs('61:05.50'), 3665500);
  assert.strictEqual(tsToMs('00:00.3334'), 333);
  assert.strictEqual(tsToMs('junk'), null);
  console.log('tsToMs edges OK');
}


// estimateWords never overwrites real word timings
{
  const lines = [{ startMs: 0, endMs: 1000, text: 'real timing', words: [{ text: 'real', startMs: 0, endMs: 500 }] }];
  estimateWords(lines);
  assert.strictEqual(lines[0].words.length, 1);
  assert.ok(!lines[0].estimated);
  console.log('estimateWords keeps real timings OK');
}

// TTML offset times carry units: 500ms is half a second, not 500 seconds
{
  const t = '<tt><body><div><p begin="1.5s" end="2500ms"><span begin="1.5s" end="2s">hi</span></p>'
          + '<p begin="1m" end="1.5m"><span begin="1m" end="61s">there</span></p>'
          + '<p begin="1h" end="90m"><span begin="1h" end="3601s">friend</span></p></div></body></tt>';
  m = parseTtml(t);
  assert.deepStrictEqual(m.lines.map(l => [l.startMs, l.endMs]),
    [[1500, 2500], [60000, 90000], [3600000, 5400000]]);
  assert.strictEqual(m.lines[0].words[0].endMs, 2000);
  assert.strictEqual(m.lines[2].words[0].endMs, 3601000);
}

// TTML with line-level timing only (no word spans): the lines are kept,
// words:null like parseLrc output, so callers can estimate word timings
{
  const t = '<tt><body><div><p begin="10s" end="12s">line one</p>'
          + '<p begin="13s" end="14s"><span begin="13s" end="14s">word</span> timed</p></div></body></tt>';
  m = parseTtml(t);
  assert.strictEqual(m.lines.length, 2);
  assert.strictEqual(m.lines[0].text, 'line one');
  assert.strictEqual(m.lines[0].words, null);
  assert.strictEqual(m.lines[0].startMs, 10000);
  assert.strictEqual(m.lines[1].text, 'word timed');
  assert.strictEqual(m.lines[1].words.length, 1);
  estimateWords(m.lines);
  assert.strictEqual(m.lines[0].estimated, true);
  assert.ok(m.lines[0].words.length === 2);
}


// estimateWords: a single-word line gets the whole line duration,
// and lines without text are left untouched
{
  const { estimateWords } = require('../src/lyrics/estimate');
  const lines = estimateWords([{ startMs: 1000, endMs: 4000, text: 'Hello' }, { startMs: 5000, endMs: 8000, text: '   ' }]);
  assert.deepStrictEqual(lines[0].words, [{ text: 'Hello', startMs: 1000, endMs: 4000 }]);
  assert.strictEqual(lines[1].words, undefined);
  console.log('ESTIMATE EDGE TESTS PASS');
}

for(const bad of [null,undefined,42,{},'prefix00:01.00','00:01.00junk','-1:00'])assert.strictEqual(tsToMs(bad),null);

assert.strictEqual(tsToMs('00:60.00'),null);assert.strictEqual(tsToMs('999999999999999999999:01'),null);assert.strictEqual(tsToMs('00:59.999'),59999);
