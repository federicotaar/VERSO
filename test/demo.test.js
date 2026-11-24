// Demo mode lyrics: self-contained sample track for verifying the overlay
// without a music player. The structure must stay a valid word-timed model.
const assert = require('assert');
const { demoLyrics, DEMO_TRACK, poll } = require('../src/demo');

const model = demoLyrics();
assert.strictEqual(model.source, 'demo');
assert.strictEqual(model.wordLevel, true);
assert.strictEqual(model.estimated, false);
assert.ok(model.lines.length >= 4);

// every line has real word timings that rebuild its text and stay in order
for (const line of model.lines) {
  assert.ok(Array.isArray(line.words) && line.words.length > 0);
  assert.strictEqual(line.words.map(w => w.text).join(' '), line.text);
  assert.ok(line.startMs >= 0 && line.endMs > line.startMs);
  let prev = line.startMs;
  for (const w of line.words) {
    assert.ok(w.startMs >= prev && w.endMs > w.startMs, 'word timings monotonic');
    prev = w.startMs;
  }
  assert.ok(line.words[0].startMs >= line.startMs);
  assert.ok(line.words[line.words.length - 1].endMs <= line.endMs);
}

// lines never overlap (the karaoke highlight would jump otherwise)
for (let i = 1; i < model.lines.length; i++) {
  assert.ok(model.lines[i].startMs >= model.lines[i - 1].endMs);
}

// poll always reports the demo track playing, with a looping position
poll().then(p => {
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.playing, true);
  assert.strictEqual(p.track, DEMO_TRACK);
  assert.ok(typeof p.positionMs === 'number' && p.positionMs >= 0 && p.positionMs < 30000);
  console.log('demo.test.js OK');
});

// Playback wraps at the declared duration, and wall-clock rollback stays nonnegative.
(async()=>{
 const original=Date.now;
 try {
  delete require.cache[require.resolve('../src/demo')];
  Date.now=()=>100000;const demo=require('../src/demo');
  Date.now=()=>145000;
  assert.strictEqual((await demo.poll()).positionMs,45000);
  Date.now=()=>165000;
  assert.strictEqual((await demo.poll()).positionMs,5000);
  Date.now=()=>99000;
  const state=await demo.poll();assert.ok(state.positionMs>=0&&state.positionMs<state.track.durationMs);
 } finally {Date.now=original;}
})().catch(e=>{console.error(e);process.exitCode=1;});

{
 const demo=require('../src/demo');
 assert.ok(Object.isFrozen(demo.DEMO_TRACK));
 const model=demo.demoLyrics();
 const last=model.lines[model.lines.length-1];
 assert.ok(last.endMs<=demo.DEMO_TRACK.durationMs,'lyrics end before the loop restarts');
 assert.ok(model.lines.every((l,i)=>i===0||l.startMs>=model.lines[i-1].endMs),'lines do not overlap');
}
