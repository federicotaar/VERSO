// getLyrics: fresh results are cached per track; on a fetch error the cached
// copy comes back flagged stale; with no cache the error yields null.
const assert = require('assert');
const path = require('path');

// stub the lrclib module before index.js requires it
const lrclibPath = require.resolve('../src/lyrics/lrclib');
let behavior = async () => ({ kind: 'lrc', lrc: '[00:01.00]hello cached world', source: 'lrclib' });
require.cache[lrclibPath] = {
  id: lrclibPath, filename: lrclibPath, loaded: true,
  exports: { fetchLyrics: (...a) => behavior(...a), pickBest: () => null, norm: String },
};
const { getLyrics } = require('../src/lyrics/index');

(async () => {
  const track = { title: 'Cached Song', artist: 'Tester', durationMs: 60000 };
  const fresh = await getLyrics(track, {});
  assert.ok(fresh && fresh.lines.length === 1 && !fresh.stale);
  assert.strictEqual(fresh.estimated, true);

  behavior = async () => { throw new Error('lrclib down'); };
  const stale = await getLyrics(track, {});
  assert.ok(stale && stale.stale === true, 'cached lyrics served stale on outage');
  assert.strictEqual(stale.lines[0].text, 'hello cached world');

  const other = await getLyrics({ title: 'Never Seen', artist: 'Nobody' }, {});
  assert.strictEqual(other, null, 'no cache, no lyrics: null, not an exception');

  // invalid tracks never throw either
  assert.strictEqual(await getLyrics(null, {}), null);
  assert.strictEqual(await getLyrics({ title: '', artist: 'x' }, {}), null);

  console.log('LYRICS-INDEX TESTS PASS');
})().catch(e => { console.error(e); process.exit(1); });
