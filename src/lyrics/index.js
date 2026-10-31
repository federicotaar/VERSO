// Provider chain. Order of truth:
//  1. Apple Music (user's own token) -> REAL word-by-word timings.
//  2. LRCLIB -> real LINE timings; words estimated and flagged as such.
//  3. Nothing found -> report no lyrics; never fake coverage.
const { parseLrc } = require('./lrcparse');
const { estimateWords } = require('./estimate');
const lrclib = require('./lrclib');
const apple = require('./apple');

async function getLyrics(track, settings) {
  // 1. Apple Music word-level (only with the user's own tokens)
  if (settings && settings.appleUserToken && settings.appleDevToken) {
    try {
      const r = await apple.fetchWordLyrics(track, settings.appleUserToken, settings.appleDevToken, settings.appleStorefront);
      if (r) {
        const model = apple.parseTtml(r.ttml);
        if (model.lines.length) return { ...model, source: r.source, wordLevel: true, estimated: false };
      }
    } catch (e) { /* fall through to lrclib */ }
  }
  // 2. LRCLIB line-level + honest estimated words
  try {
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
  } catch (e) { /* no lyrics */ }
  return null;
}

module.exports = { getLyrics };
