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
const { getLyrics, cacheSize, clearCache } = require('../src/lyrics/index');

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

  behavior = async () => ({kind:'lrc',lrc:'[00:01]album one',source:'lrclib'});
  const edition={title:'Edition',artist:'Tester',album:'Album One',durationMs:60000};
  await getLyrics(edition,{});
  behavior = async () => {throw new Error('offline');};
  assert.strictEqual(await getLyrics({...edition,album:'Album Two'},{}),null);
  behavior = async () => ({kind:'lrc',lrc:'[00:01]delimiter one',source:'lrclib'});
  await getLyrics({title:'a|b',artist:'c'},{});
  behavior = async () => {throw new Error('offline');};
  assert.strictEqual(await getLyrics({title:'a',artist:'b|c'},{}),null);
  behavior = async () => ({kind:'lrc',lrc:'[00:01]temporary',source:'lrclib'});
  const removed={title:'Removed',artist:'Tester'};
  await getLyrics(removed,{});
  behavior = async () => null;
  assert.strictEqual(await getLyrics(removed,{}),null);
  behavior = async () => {throw Error('offline');};
  assert.strictEqual(await getLyrics(removed,{}),null,'do not resurrect removed provider results');
  clearCache();assert.strictEqual(cacheSize(),0);
  behavior = async () => ({kind:'lrc',lrc:'[00:01]cap',source:'lrclib'});
  for(let i=0;i<25;i++)await getLyrics({title:'cap'+i,artist:'tester'},{});
  assert.strictEqual(cacheSize(),20,'cache is capped');
  clearCache();assert.strictEqual(cacheSize(),0);
  console.log('LYRICS-INDEX TESTS PASS');
})().catch(e => { console.error(e); process.exit(1); });
