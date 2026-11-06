// Parse standard LRC and enhanced (word-timed) LRC into a unified model:
// { lines: [{ startMs, endMs, text, words: [{ text, startMs, endMs }] | null }] }
function tsToMs(tag) {
  const m = tag.match(/(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round((parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000);
}

function parseLrc(lrc) {
  const out = [];
  // A line may carry several leading timestamps (repeated chorus): [00:10.00][00:50.00]text
  const lineRe = /^((?:[ \t]*\[\d+:\d+(?:\.\d+)?\])+)(.*)$/gm;
  let match;
  while ((match = lineRe.exec(lrc)) !== null) {
    const starts = [...match[1].matchAll(/\[(\d+:\d+(?:\.\d+)?)\]/g)].map(x => tsToMs(x[1])).filter(x => x !== null);
    let body = match[2].replace(/\r$/, '');
    if (!starts.length) continue;
    // enhanced LRC word tags: <mm:ss.xx>word
    const words = [];
    const wordRe = /<(\d+:\d+(?:\.\d+)?)>([^<]*)/g;
    let w, lastEnd = null, hasWordTags = false;
    while ((w = wordRe.exec(body)) !== null) {
      hasWordTags = true;
      const wStart = tsToMs(w[1]);
      if (wStart === null) continue;
      if (lastEnd !== null && words.length) words[words.length - 1].endMs = wStart;
      words.push({ text: w[2], startMs: wStart, endMs: null });
      lastEnd = wStart;
    }
    const text = hasWordTags ? words.map(x => x.text).join('').trim()
                             : body.replace(/<[^>]*>/g, '').trim();
    starts.forEach((startMs, i) => {
      const shift = startMs - starts[0];
      const ws = hasWordTags && words.length
        ? words.map(x => ({ text: x.text, startMs: x.startMs + shift, endMs: x.endMs === null ? null : x.endMs + shift }))
        : null;
      out.push({ startMs, endMs: null, text, words: ws });
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    out[i].endMs = next ? next.startMs : out[i].startMs + 5000;
    if (out[i].words) {
      const ws = out[i].words;
      if (ws.length && ws[ws.length - 1].endMs === null) ws[ws.length - 1].endMs = out[i].endMs;
      for (let j = 0; j + 1 < ws.length; j++) if (ws[j].endMs === null) ws[j].endMs = ws[j + 1].startMs;
    }
  }
  return { lines: out.filter(l => l.text) };
}

module.exports = { parseLrc, tsToMs };
