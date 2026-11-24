// Active-line lookup: which lyric line is current at a playback position.
// Binary search over startMs (lines are sorted by parseLrc/parseTtml).
// Contract: returns the index of the last line that has STARTED (startMs <=
// positionMs), or -1 before the first line. A started line stays current
// until the next one starts, even past its own endMs (instrumental gaps keep
// the previous line dimmed instead of dropping the highlight entirely).
function findActiveLine(lines, positionMs) {
  if (!Array.isArray(lines) || !lines.length || !Number.isFinite(positionMs)) return -1;
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = lines[mid] && Number.isFinite(lines[mid].startMs) ? lines[mid].startMs : Infinity;
    if (s <= positionMs) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

// Index of the first line that starts after positionMs, or -1 when none remain.
function findNextLine(lines, positionMs) {
  if (!Array.isArray(lines) || !Number.isFinite(positionMs)) return -1;
  const active = findActiveLine(lines, positionMs);
  const next = active + 1;
  return next < lines.length ? next : -1;
}

module.exports = { findActiveLine, findNextLine };
