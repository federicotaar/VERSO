// Estimated word timings: split each line's duration across its words,
// weighted by word length. HONEST fallback only - callers must keep
// estimated:true so the UI can say these are not real word timings.
function estimateWords(lines) {
  for (const line of lines) {
    if (line.words) continue;
    const parts = line.text.split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const dur = Math.max(1, (line.endMs || line.startMs + 3000) - line.startMs);
    const total = parts.reduce((a, w) => a + w.length, 0);
    let t = line.startMs;
    line.words = parts.map(w => {
      const wDur = dur * (w.length / total);
      const word = { text: w, startMs: Math.round(t), endMs: Math.round(t + wDur) };
      t += wDur;
      return word;
    });
    line.estimated = true;
  }
  return lines;
}

module.exports = { estimateWords };
