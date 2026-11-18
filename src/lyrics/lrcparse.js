// Parse standard LRC and enhanced (word-timed) LRC into a unified model:
// { lines: [{ startMs, endMs, text, words: [{ text, startMs, endMs }] | null }] }
function tsToMs(tag) {
  if(typeof tag!=='string')return null;
  const m=tag.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const seconds=Number(m[2]);
  const ms=Math.round((Number(m[1])*60+seconds)*1000);
  return seconds<60&&Number.isSafeInteger(ms)?ms:null;
}

function parseLrc(lrc) {
  const out = [];
  if(typeof lrc!=='string')return {lines:out};
  // [offset:+/-ms] shifts every timestamp; per the LRC spec + makes lyrics
  // appear sooner, so it is SUBTRACTED from the raw times.
  const offsetMatch = lrc.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/m);
  const parsedOffset = offsetMatch ? Number(offsetMatch[1]) : 0;
  const offsetMs = Number.isSafeInteger(parsedOffset) ? parsedOffset : 0;
  // A line may carry several leading timestamps (repeated chorus): [00:10.00][00:50.00]text
  const lineRe = /^[ \t\uFEFF]*((?:[ \t]*\[\d+:\d+(?:\.\d+)?\])+)(.*)$/gm;
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
    const orderedWords = words.every((w,i) => i===0 || w.startMs>=words[i-1].startMs);
    const text = hasWordTags ? words.map(x => x.text).join('').trim()
                             : body.replace(/<[^>]*>/g, '').trim();
    starts.forEach((startMs) => {
      const shift = startMs - starts[0] - offsetMs;
      const ws = hasWordTags && orderedWords && words.length
        ? words.map(x => ({ text: x.text, startMs: x.startMs + shift, endMs: x.endMs === null ? null : x.endMs + shift }))
        : null;
      out.push({ startMs: startMs - offsetMs, endMs: null, text, words: ws });
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
