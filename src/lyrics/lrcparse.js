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
  if(typeof lrc!=='string')return {lines:out, meta:{}};
  // LRC ID tags ([ti:], [ar:], [al:], [by:], [length:]) are metadata, not
  // lyrics: capture them into meta for display/debug instead of dropping them.
  const meta = {};
  for (const tm of lrc.matchAll(/^\s*\[(ti|ar|al|by|length):\s*([^\]]*)\]/gm)) {
    const v = tm[2].trim();
    if (v) meta[tm[1]] = v;
  }
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
  return { lines: out.filter(l => l.text), meta };
}

module.exports = { parseLrc, tsToMs };


// Export only finite, non-empty timed lines. Do not mutate the live model.
function exportableLines(model) {
  if (!model || model.unsynced || !Array.isArray(model.lines)) return [];
  return model.lines.filter(l => l && typeof l.text === 'string' && l.text.trim()
    && Number.isFinite(l.startMs) && Number.isSafeInteger(Math.round(l.startMs)) && l.startMs >= 0
    && Number.isFinite(l.endMs) && Number.isSafeInteger(Math.round(l.endMs)) && Math.round(l.endMs) > Math.round(l.startMs))
    .map(l => ({ startMs: Math.round(l.startMs), endMs: Math.round(l.endMs),
      text: l.text.replace(/[\r\n]+/g, ' ').trim() }))
    .sort((a,b) => a.startMs-b.startMs);
}
function toLrc(model) {
  return exportableLines(model).map(l => {
    const ms = l.startMs, minutes = Math.floor(ms/60000), seconds = Math.floor(ms/1000)%60;
    return `[${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}]${l.text}`;
  }).join('\n');
}
module.exports.toLrc = toLrc;

function subtitleTimestamp(ms, separator) {
  const hours=Math.floor(ms/3600000), minutes=Math.floor(ms/60000)%60, seconds=Math.floor(ms/1000)%60;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}${separator}${String(ms%1000).padStart(3,'0')}`;
}
// Escape markup so a lyric containing <i> or an arrow remains literal text.
function subtitleText(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function toSrt(model) {
  return exportableLines(model).map((l,i) => `${i+1}\n${subtitleTimestamp(l.startMs,',')} --> ${subtitleTimestamp(l.endMs,',')}\n${subtitleText(l.text)}\n`).join('\n');
}
module.exports.toSrt = toSrt;

function toVtt(model) {
  const cues=exportableLines(model).map(l => `${subtitleTimestamp(l.startMs,'.')} --> ${subtitleTimestamp(l.endMs,'.')}\n${subtitleText(l.text)}\n`);
  return 'WEBVTT\n\n' + cues.join('\n');
}
module.exports.toVtt = toVtt;

// [length: mm:ss] ID tag -> milliseconds, or null when absent or malformed
function metaLengthMs(meta) {
  if (!meta || typeof meta.length !== 'string') return null;
  return tsToMs(meta.length.trim());
}
module.exports.metaLengthMs = metaLengthMs;

// Returns a copy of the model with all line and word times moved by deltaMs (never below 0).
function shiftLines(model, deltaMs) {
  if (!model || !Array.isArray(model.lines) || !Number.isFinite(deltaMs)) return model;
  const mv = ms => (Number.isFinite(ms) ? Math.max(0, Math.round(ms + deltaMs)) : ms);
  return { ...model, lines: model.lines.map(l => ({ ...l,
    startMs: mv(l.startMs), endMs: mv(l.endMs),
    words: Array.isArray(l.words) ? l.words.map(w => ({ ...w, startMs: mv(w.startMs), endMs: mv(w.endMs) })) : l.words })) };
}
module.exports.shiftLines = shiftLines;

function modelDurationMs(model) {
  if (!model || model.unsynced || !Array.isArray(model.lines)) return 0;
  let end = 0;
  for (const l of model.lines) {
    const e = l && Number.isFinite(l.endMs) ? l.endMs : (l && Number.isFinite(l.startMs) ? l.startMs : 0);
    if (e > end) end = e;
  }
  return end;
}
module.exports.modelDurationMs = modelDurationMs;

// Plain text, one line per lyric in time order, without timestamps.
function toTxt(model) {
  return exportableLines(model).map(l => l.text).join('\n');
}
module.exports.toTxt = toTxt;

// Number of lines that would be exported (finite, non-empty, timed).
function lineCount(model) {
  return exportableLines(model).length;
}
module.exports.lineCount = lineCount;

// Whitespace-separated words across the exportable lines.
function wordCount(model) {
  return exportableLines(model).reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
}
module.exports.wordCount = wordCount;

// Pretty JSON of the exportable lines: [{startMs, endMs, text}].
function toJson(model) {
  return JSON.stringify(exportableLines(model), null, 2);
}
module.exports.toJson = toJson;

// CSV with a header row; text is always quoted and embedded quotes are doubled.
function toCsv(model) {
  const rows = exportableLines(model).map(l => `${l.startMs},${l.endMs},"${l.text.replace(/"/g, '""')}"`);
  return ['startMs,endMs,text', ...rows].join('\n');
}
module.exports.toCsv = toCsv;

// Copy of the model with every line and word time multiplied by factor (> 0).
function scaleLines(model, factor) {
  if (!model || !Array.isArray(model.lines) || !Number.isFinite(factor) || factor <= 0) return model;
  const mv = ms => (Number.isFinite(ms) ? Math.round(ms * factor) : ms);
  return { ...model, lines: model.lines.map(l => ({ ...l,
    startMs: mv(l.startMs), endMs: mv(l.endMs),
    words: Array.isArray(l.words) ? l.words.map(w => ({ ...w, startMs: mv(w.startMs), endMs: mv(w.endMs) })) : l.words })) };
}
module.exports.scaleLines = scaleLines;

// Gaps in ms between the end of each exportable line and the start of the next one.
function lineGaps(model) {
  const lines = exportableLines(model);
  const gaps = [];
  for (let i = 0; i + 1 < lines.length; i++) gaps.push(Math.max(0, lines[i + 1].startMs - lines[i].endMs));
  return gaps;
}
module.exports.lineGaps = lineGaps;

// Breaks of at least minMs (default 8s): [{startMs, endMs}] between two lyric lines.
function instrumentalBreaks(model, minMs = 8000) {
  const lines = exportableLines(model);
  const breaks = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (lines[i + 1].startMs - lines[i].endMs >= minMs) breaks.push({ startMs: lines[i].endMs, endMs: lines[i + 1].startMs });
  }
  return breaks;
}
module.exports.instrumentalBreaks = instrumentalBreaks;

// Start of the first exportable line and end of the last one, or null when none.
function firstLineMs(model) {
  const lines = exportableLines(model);
  return lines.length ? lines[0].startMs : null;
}
function lastLineMs(model) {
  const lines = exportableLines(model);
  return lines.length ? Math.max(...lines.map(l => l.endMs)) : null;
}
module.exports.firstLineMs = firstLineMs;
module.exports.lastLineMs = lastLineMs;

// Merges back-to-back lines with identical text (e.g. doubled by two sources) into one span.
function dedupeConsecutiveLines(model) {
  if (!model || !Array.isArray(model.lines)) return model;
  const out = [];
  for (const l of model.lines) {
    const prev = out[out.length - 1];
    if (prev && l && prev.text === l.text && Number.isFinite(l.startMs) && Number.isFinite(prev.endMs) && l.startMs <= prev.endMs) {
      if (Number.isFinite(l.endMs) && l.endMs > prev.endMs) prev.endMs = l.endMs;
    } else {
      out.push({ ...l });
    }
  }
  return { ...model, lines: out };
}
module.exports.dedupeConsecutiveLines = dedupeConsecutiveLines;

// Mean duration of the exportable lines in ms (rounded), or null when there are none.
function averageLineMs(model) {
  const lines = exportableLines(model);
  if (!lines.length) return null;
  return Math.round(lines.reduce((n, l) => n + (l.endMs - l.startMs), 0) / lines.length);
}
module.exports.averageLineMs = averageLineMs;

// The exportable line with the longest duration (first one wins a tie), or null.
function longestLine(model) {
  let best = null;
  for (const l of exportableLines(model)) {
    if (!best || l.endMs - l.startMs > best.endMs - best.startMs) best = l;
  }
  return best;
}
module.exports.longestLine = longestLine;
