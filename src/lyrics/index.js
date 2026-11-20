// Provider chain. LRCLIB only for now: real LINE timings, words estimated
// and flagged as such. No credential-based provider is enabled until an
// authorized sign-in flow with secure storage exists (see ttml.js note).
const { parseLrc } = require('./lrcparse');
const { estimateWords } = require('./estimate');
const lrclib = require('./lrclib');

// Last good lyrics per track: a brief LRCLIB outage must not blank the
// overlay on every poll. Entries are keyed by title/artist/duration and
// marked stale so the UI can keep showing real (if not freshly fetched)
// lyrics instead of nothing. Unbounded growth is capped by the map size.
const cache = new Map();
const CACHE_MAX = 20;
function trackKey(track) {
  if (!track || typeof track.title !== 'string' || typeof track.artist !== 'string') return null;
  const t = track.title.trim(), a = track.artist.trim();
  if (!t || !a) return null;
  const d = Number.isFinite(track.durationMs) ? Math.round(track.durationMs / 1000) : 0;
  const album = typeof track.album === 'string' ? track.album.trim().toLowerCase() : '';
  return JSON.stringify([t.toLowerCase(), a.toLowerCase(), album, d]);
}

async function getLyrics(track, settings) {
  const key = trackKey(track);
  try {
    const r = await lrclib.fetchLyrics(track);
    if (r) {
      let model;
      if (r.kind === 'lrc') {
        model = parseLrc(r.lrc);
        estimateWords(model.lines);
        model = { ...model, source: r.source, wordLevel: false, estimated: true };
      } else if (r.kind === 'plain') {
        model = { lines: r.plain.split('\n').filter(Boolean).map(t => ({ startMs: 0, endMs: 0, text: t, words: null })),
                  source: r.source, wordLevel: false, unsynced: true };
      }
      if (model && key) {
        cache.set(key, model);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      }
      return model;
    }
  } catch (e) {
    if (key && cache.has(key)) return { ...cache.get(key), stale: true };
    return null;
  }
  if (key) cache.delete(key);
  return null;
}

module.exports = { getLyrics };
