// LRCLIB lookup: exact lookup first, strict search fallback, never a wrong song.
const assert = require('assert');
const { fetchLyrics, pickBest, norm } = require('../src/lyrics/lrclib');

assert.strictEqual(norm("Stayin' Alive - Remastered"), norm('Stayin Alive (Remastered Version)'));
assert.strictEqual(norm('Mamma Mia - 2011 Remaster'), 'mamma mia');
assert.strictEqual(norm('Fiori rosa, fiori di pesco'), norm('Fiori Rosa Fiori Di Pesco'));
assert.strictEqual(norm('Industry Baby (feat. Jack Harlow)'), 'industry baby');
assert.strictEqual(norm('Café Tacvba'), 'cafe tacvba');
assert.notStrictEqual(norm('Hello'), norm('Hello Goodbye'));

const r = (t, a, d, synced = 'x', extra = {}) => ({ trackName: t, artistName: a, duration: d, syncedLyrics: synced, ...extra });
const track = { title: "Stayin' Alive - Remastered", artist: 'Bee Gees', durationMs: 285000 };
// picks the closest duration among matching title/artist
assert.strictEqual(pickBest(track, [r('Stayin Alive', 'Bee Gees', 250), r("Stayin' Alive (Remastered Version)", 'Bee Gees', 283), r("Stayin' Alive (Remastered Version)", 'Bee Gees', 285)]).duration, 285);
// wrong duration (a different cut), wrong artist, wrong title, no synced lyrics, instrumental: all rejected
assert.strictEqual(pickBest(track, [r("Stayin' Alive", 'Bee Gees', 414)]), null);
assert.strictEqual(pickBest(track, [r("Stayin' Alive", 'Cover Band', 285)]), null);
assert.strictEqual(pickBest(track, [r('Alive', 'Bee Gees', 285)]), null);
assert.strictEqual(pickBest(track, [r("Stayin' Alive", 'Bee Gees', 285, '')]), null);
assert.strictEqual(pickBest(track, [r("Stayin' Alive", 'Bee Gees', 285, 'x', { instrumental: true })]), null);
assert.strictEqual(pickBest({ title: '', artist: 'x' }, [r('a', 'x', 1)]), null);
// no reported duration: title+artist must still match
assert.strictEqual(pickBest({ title: 'Alive', artist: 'Bee Gees' }, [r('Alive', 'Bee Gees', 100)]).duration, 100);

(async () => {
  const urls = [];
  // exact hit: no search call
  let res = await fetchLyrics(track, async u => { urls.push(u); return { syncedLyrics: '[00:01.00]hi' }; });
  assert.strictEqual(res.kind, 'lrc');
  assert.strictEqual(urls.length, 1);
  assert.ok(urls[0].includes('/api/get?') && urls[0].includes('duration=285'));
  // miss, then strict search match
  urls.length = 0;
  res = await fetchLyrics(track, async u => { urls.push(u); return u.includes('/api/get') ? null : [r("Stayin' Alive (Remastered Version)", 'Bee Gees', 285, '[00:01.00]hey')]; });
  assert.strictEqual(res.kind, 'lrc');
  assert.strictEqual(urls.length, 2);
  assert.ok(urls[1].includes('/api/search?') && !urls[1].includes('duration'));
  // miss, only a different song/cut found: null, never wrong lyrics
  res = await fetchLyrics(track, async u => u.includes('/api/get') ? null : [r("Stayin' Alive", 'Bee Gees', 414), r('Other', 'Bee Gees', 285)]);
  assert.strictEqual(res, null);
  // plain lyrics only on exact hit
  res = await fetchLyrics(track, async () => ({ plainLyrics: 'a\nb' }));
  assert.strictEqual(res.kind, 'plain');
  // search failure propagates (caller already handles errors/retry)
  await assert.rejects(fetchLyrics(track, async u => { if (u.includes('/api/search')) throw new Error('HTTP 503'); return null; }));
  console.log('LRCLIB TESTS PASS');
})().catch(e => { console.error(e); process.exit(1); });
