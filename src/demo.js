// Demo mode (VERSO_DEMO=1): fake now-playing + original sample word-timed lyrics
// so the overlay can be visually verified without a music player or network.
// Sample words are original placeholder lines, not real song lyrics.
const DEMO_TRACK = {
  title: 'Demo Notturna', artist: 'VERSO', album: 'Preview',
  durationMs: 60000, artUrl: null, source: 'demo'
};

function demoLyrics() {
  const lines = [];
  const texts = [
    'la notte accende le stelle',
    'il mondo corre veloce',
    'il cuore batte nel buio',
    'la luce resta accesa',
    'il sogno vola via',
    'la musica non muore mai'
  ];
  let t = 2000;
  for (const text of texts) {
    const words = [];
    let wt = t;
    for (const w of text.split(' ')) {
      const dur = 260 + w.length * 55;
      words.push({ text: w, startMs: wt, endMs: wt + dur });
      wt += dur + 60;
    }
    lines.push({ startMs: t, endMs: wt, text, words });
    t = wt + 700;
  }
  return { lines, source: 'demo', wordLevel: true, estimated: false };
}

let start = Date.now();
async function poll() {
  return {
    ok: true, playing: true,
    positionMs: (Date.now() - start) % 30000,
    track: DEMO_TRACK
  };
}

module.exports = { poll, demoLyrics, DEMO_TRACK };
