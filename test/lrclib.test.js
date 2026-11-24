// LRCLIB lookup: exact lookup first, strict search fallback, never a wrong song.
const assert = require('assert');
const { fetchLyrics, pickBest, norm } = require('../src/lyrics/lrclib');

assert.strictEqual(norm("Stayin' Alive - Remastered"), norm('Stayin Alive (Remastered Version)'));
assert.strictEqual(norm('Mamma Mia - 2011 Remaster'), 'mamma mia');
assert.strictEqual(norm('Fiori rosa, fiori di pesco'), norm('Fiori Rosa Fiori Di Pesco'));
assert.strictEqual(norm('Industry Baby (feat. Jack Harlow)'), 'industry baby');
assert.strictEqual(norm('The Chain (Live at Wembley)'), 'the chain');
assert.strictEqual(norm('Godzilla feat. Juice WRLD'), 'godzilla');
assert.strictEqual(norm('Moonlight ft. Kali Uchis'), 'moonlight');
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
// duration gate: exactly 3 s off still matches, more does not; non-number durations rejected
assert.strictEqual(pickBest({ title: 'Alive', artist: 'Bee Gees', durationMs: 283000 }, [r('Alive', 'Bee Gees', 286)]).duration, 286);
assert.strictEqual(pickBest({ title: 'Alive', artist: 'Bee Gees', durationMs: 283000 }, [r('Alive', 'Bee Gees', 286.5)]), null);
assert.strictEqual(pickBest({ title: 'Alive', artist: 'Bee Gees', durationMs: 283000 }, [r('Alive', 'Bee Gees', '283')]), null);
// album tie-break: same title/artist/duration, the reported album wins
assert.strictEqual(pickBest({ title: 'Song', artist: 'A', album: 'Greatest Hits', durationMs: 200000 },
  [r('Song', 'A', 200, 'x', { albumName: 'Original Album' }), r('Song', 'A', 200, 'x', { albumName: 'Greatest Hits' })]).albumName, 'Greatest Hits');
// unknown or missing album on the track: first (closest-duration) candidate, unchanged behaviour
assert.strictEqual(pickBest({ title: 'Song', artist: 'A', durationMs: 200000 },
  [r('Song', 'A', 200, 'x', { albumName: 'Original Album' }), r('Song', 'A', 200, 'x', { albumName: 'Greatest Hits' })]).albumName, 'Original Album');
// a non-matching album is ignored rather than rejecting the match
assert.strictEqual(pickBest({ title: 'Song', artist: 'A', album: 'Live Bootleg', durationMs: 200000 },
  [r('Song', 'A', 200, 'x', { albumName: 'Studio Album' })]).albumName, 'Studio Album');

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

for(const bad of [null,undefined,42])assert.strictEqual(pickBest(bad,[]),null);assert.strictEqual(pickBest(track,{}),null);

for(const bad of [NaN,Infinity,-100,'285000'])assert.ok(pickBest({...track,durationMs:bad},[r('Stayin Alive','Bee Gees',285)]));

for(const bad of [true,{},[],42,'   '])assert.strictEqual(pickBest(track,[r('Stayin Alive','Bee Gees',285,bad)]),null);

assert.strictEqual(pickBest(track,[null,{},r('Stayin Alive','Bee Gees',285)]).duration,285);assert.strictEqual(pickBest(track,[r('Stayin Alive','Bee Gees',NaN)]),null);

(async()=>{
 for(const track of [null,{}, {title:' ',artist:'x'},{title:'x',artist:42}]){
  assert.strictEqual(await fetchLyrics(track,()=>{throw Error('must not request')}),null);
 }
 for(const durationMs of [NaN,Infinity,-1,'1000']){
  await fetchLyrics({title:'x',artist:'y',durationMs},async url=>{
   assert.strictEqual(new URL(url).searchParams.has('duration'),false);
   return {plainLyrics:'text'};
  });
 }
 for(const response of [[],42,{instrumental:true,syncedLyrics:'[00:01]wrong'},{syncedLyrics:42,plainLyrics:{}},{plainLyrics:'  '}]){
  assert.strictEqual(await fetchLyrics({title:'x',artist:'y'},async()=>response),null);
 }
 console.log('PROVIDER INPUT AND RESPONSE TESTS PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Non-Latin titles/artists remain meaningful and do not collapse into empty strings.
assert.strictEqual(norm('夜に駆ける'), '夜に駆ける');
assert.notStrictEqual(norm('夜に駆ける'),norm('群青'));
assert.strictEqual(pickBest({title:'群青',artist:'ヨアソビ'},[r('群青','ヨアソビ',200)]).trackName,'群青');
assert.strictEqual(pickBest({title:'群青',artist:'ヨアソビ'},[r('夜に駆ける','ヨアソビ',200)]),null);

(async()=>{
 const {fetchLyrics}=require('../src/lyrics/lrclib');
 const track={title:'Same title',artist:'Same artist',album:'Original',durationMs:120000};
 let calls=0;
 const result=await fetchLyrics(track,async()=>++calls===1?null:[
  {trackName:track.title,artistName:track.artist,albumName:'Compilation',duration:120,syncedLyrics:'[00:01]wrong edition'},
  {trackName:track.title,artistName:track.artist,albumName:'Original',duration:120,syncedLyrics:'[00:01]correct edition'}
 ]);
 assert.ok(result.lrc.includes('correct edition'));
})().catch(e=>{console.error(e);process.exitCode=1;});

(async()=>{
 const urls=[];
 await fetchLyrics({title:'  Padded Song ',artist:' Someone  ',album:' Rec ',durationMs:90000},async u=>{urls.push(u);return {syncedLyrics:'[00:01]x'}});
 const q=new URL(urls[0]).searchParams;
 assert.strictEqual(q.get('track_name'),'Padded Song');
 assert.strictEqual(q.get('artist_name'),'Someone');
 assert.strictEqual(q.get('album_name'),'Rec');
})().catch(e=>{console.error(e);process.exitCode=1;});
