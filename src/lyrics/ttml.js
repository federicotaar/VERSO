// TTML word-timing parser (pure function, no network, no credentials).
// Kept for a future AUTHORIZED Apple Music sign-in flow (MusicKit user auth
// with OS-level secure storage). Not wired to any provider yet.
// TTML -> unified model with word timings
function parseTtml(ttml) {
  const lines = [];
  const pRe = /<p[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  const spanRe = /<span[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
  const toMs = s => {
    const m = s.match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);
    if (m) return Math.round(((+m[1] || 0) * 3600 + (+m[2]) * 60 + parseFloat(m[3])) * 1000);
    const f = parseFloat(s);
    return isNaN(f) ? null : Math.round(f * 1000);
  };
  const strip = h => h.replace(/<[^>]+>/g, '');
  let m;
  while ((m = pRe.exec(ttml)) !== null) {
    const line = { startMs: toMs(m[1]), endMs: toMs(m[2]), text: '', words: [] };
    let sm;
    while ((sm = spanRe.exec(m[3])) !== null) {
      const w = { text: strip(sm[3]), startMs: toMs(sm[1]), endMs: toMs(sm[2]) };
      line.words.push(w);
    }
    line.text = line.words.length ? line.words.map(w => w.text).join('').replace(/\s+/g, ' ').trim()
                                  : strip(m[3]).trim();
    if (line.text) lines.push(line);
  }
  return { lines: lines.filter(l => l.words.length) };
}


module.exports = { parseTtml };
