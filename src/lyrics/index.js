// Provider chain. LRCLIB only for now: real LINE timings, words estimated
// and flagged as such. No credential-based provider is enabled until an
// authorized sign-in flow with secure storage exists (see ttml.js note).
const { parseLrc } = require('./lrcparse');
const { estimateWords } = require('./estimate');
const lrclib = require('./lrclib');

async function getLyrics(track, settings) {
  {
    const r = await lrclib.fetchLyrics(track);
    if (r && r.kind === 'lrc') {
      const model = parseLrc(r.lrc);
      estimateWords(model.lines);
      return { ...model, source: r.source, wordLevel: false, estimated: true };
    }
    if (r && r.kind === 'plain') {
      return { lines: r.plain.split('\n').filter(Boolean).map(t => ({ startMs: 0, endMs: 0, text: t, words: null })),
               source: r.source, wordLevel: false, unsynced: true };
    }
  }
  return null;
}

module.exports = { getLyrics };
