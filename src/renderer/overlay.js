/* global ICONS, iconFor */
const wall = document.getElementById('wall');
const emptyEl = document.getElementById('empty');
const stage = document.getElementById('stage');
const artEl = document.getElementById('art');
const npTitle = document.getElementById('np-title');
const npArtist = document.getElementById('np-artist');
const lyrSource = document.getElementById('lyr-source');

let settings = { mode: 'ship', colors: { lyric: '#aab4c8', highlight: '#ffffff', secondary: '#6b7688' }, colorMode: 'auto' };
let model = null;           // { lines, source, wordLevel, estimated, unsynced }
let currentTrack = null;
let lyricsFetchError = false;

function emptyText() {
  if (!currentTrack) return 'VERSO - play something in Spotify or your music app';
  return lyricsFetchError ? 'Lyrics service unreachable - retrying' : 'No synced lyrics for this track';
}
let playback = { playing: false, positionMs: 0, positionAt: Date.now() };
let lineEls = [];

function applyColors(c) {
  document.documentElement.style.setProperty('--lyric', c.lyric);
  document.documentElement.style.setProperty('--highlight', c.highlight);
  document.documentElement.style.setProperty('--secondary', c.secondary);
}
function applyMode() {
  stage.className = 'mode-' + settings.mode;
  document.documentElement.classList.add('fs');
  stage.classList.add('fs');
  document.getElementById('ctl').style.display = settings.fullscreen ? 'flex' : 'none';
  document.documentElement.classList.toggle('fsw', !!settings.fullscreen);
  render();
}
const chainSvg = document.getElementById('chain-svg');
let chainPaths = [];
let chainCells = [];
const SVGNS = 'http://www.w3.org/2000/svg';
// Persistent lyric map: every line keeps its place on a self-avoiding walk (up, down, left, right, diagonals).
// Sung lines shrink and dim but never disappear; the CAMERA pans to follow the current line, so older text
// simply drifts out of view.
const CH_SCALE = [1, 0.5, 0.38, 0.3], CH_OPAC = [1, 0.55, 0.4, 0.3];
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function chainLayout(n) {
  const rnd = mulberry(7), cells = [[0, 0]], used = new Set(['0,0']), edges = new Set();
  const key = (x, y) => x + ',' + y;
  const freeN = (x, y) => { let k = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !used.has(key(x + dx, y + dy))) k++; return k; };
  let last = [0, 0];
  for (let i = 1; i < n; i++) {
    const c = cells[i - 1];
    let cand = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = c[0] + dx, ny = c[1] + dy;
      if (used.has(key(nx, ny))) continue;
      // a diagonal step must not cut across an existing diagonal connector (X crossing)
      if (dx && dy && (edges.has(key(c[0] + dx, c[1]) + '|' + key(c[0], c[1] + dy)) || edges.has(key(c[0], c[1] + dy) + '|' + key(c[0] + dx, c[1])))) continue;
      cand.push({ c: [nx, ny], d: [dx, dy], free: 0 });
    }
    cand.forEach(q => { used.add(key(q.c[0], q.c[1])); q.free = freeN(q.c[0], q.c[1]); used.delete(key(q.c[0], q.c[1])); });
    const alive = cand.filter(q => q.free >= 4); if (alive.length) cand = alive;   // prefer open ground: no dead ends, no jumps, no crossings (checked up to 200 lines)
    const varied = cand.filter(q => q.d[0] !== last[0] || q.d[1] !== last[1]);
    if (varied.length) cand = varied;
    if (Math.hypot(c[0], c[1]) > 3 && cand.length > 1) { cand.sort((p, q) => Math.hypot(p.c[0], p.c[1]) - Math.hypot(q.c[0], q.c[1])); cand = cand.slice(0, Math.ceil(cand.length / 2)); }
    if (!cand.length) { // boxed in (should not happen): nearest free cell
      for (let r = 2; r < 9 && !cand.length; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !used.has(key(c[0] + dx, c[1] + dy))) cand.push({ c: [c[0] + dx, c[1] + dy], d: [Math.sign(dx), Math.sign(dy)] });
      }
    }
    const pick = cand[Math.floor(rnd() * cand.length)];
    cells.push(pick.c); used.add(key(pick.c[0], pick.c[1])); last = pick.d;
    edges.add(key(c[0], c[1]) + '|' + key(pick.c[0], pick.c[1]));
  }
  return cells;
}
let cam = null, lastFrameT = 0;
function chainBuild() {
  chainSvg.innerHTML = ''; chainPaths = [];
  chainCells = chainLayout(lineEls.length); cam = null;
  lineEls.forEach(le => { le.s = 1; le.o = 0; le.px = 0; le.py = 0; });
  for (let i = 0; i < lineEls.length - 1; i++) {
    const p = document.createElementNS(SVGNS, 'path'); p.style.opacity = 0; chainSvg.appendChild(p);
    p.dots = [0, 1].map(() => { const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', 3.2); c.style.opacity = 0; chainSvg.appendChild(c); return c; });
    chainPaths.push(p);
  }
}
const CH_LEAD = 1100;
function chainRender(pos, cur) {
  const W = window.innerWidth, H = window.innerHeight;
  const now = performance.now(), dt = Math.min(0.1, Math.max(0.001, (now - (lastFrameT || now)) / 1000)); lastFrameT = now;
  const CW = W * 0.36, CHh = H * 0.34;
  const tgt = i => [chainCells[i][0] * CW, chainCells[i][1] * CHh];
  const cidx = Math.max(0, cur);
  const T = tgt(cidx);
  if (!cam) cam = { x: T[0], y: T[1] };
  const kc = 1 - Math.exp(-dt / 0.38); cam.x += (T[0] - cam.x) * kc; cam.y += (T[1] - cam.y) * kc;
  const ks = 1 - Math.exp(-dt / 0.22), ko = 1 - Math.exp(-dt / 0.3);
  const vis = [];
  lineEls.forEach((le, i) => {
    const a = cur - i, el = le.el, P = tgt(i);
    const ts = a < 0 ? 1 : CH_SCALE[Math.min(a, 3)], to = a < 0 ? 0 : CH_OPAC[Math.min(a, 3)];
    le.s += (ts - le.s) * ks; le.o += (to - le.o) * ko;
    const rx = P[0] - cam.x, ry = P[1] - cam.y;
    const on = Math.abs(rx) < W * 0.75 && Math.abs(ry) < H * 0.75;
    vis[i] = on;
    el.style.transform = `translate(-50%,-50%) translate(${rx}px, ${ry}px) scale(${le.s})`;
    el.style.visibility = on ? 'visible' : 'hidden';  // keep layout so connector endpoints stay measurable
    if (!on) return;
    el.className = 'line ' + (a === 0 ? 'current' : a > 0 ? 'past' : 'chain-hide');
    el.style.opacity = a < 0 ? 0 : le.o;
  });
  const edge = (w, h, dx, dy) => Math.min(w / Math.max(1e-6, Math.abs(dx)), h / Math.max(1e-6, Math.abs(dy)));
  const nextStart = cur + 1 < lineEls.length ? lineEls[cur + 1].line.startMs : Infinity;
  chainPaths.forEach((p, i) => {
    const n = i + 1, age = cur - n;
    const hide = () => { p.style.opacity = 0; p.dots.forEach(c => c.style.opacity = 0); };
    if (!(vis[i] || vis[n]) || age < -1 || (age === -1 && i !== cur) || cur < 0 && i !== 0) return hide();
    const a = lineEls[i].el, b = lineEls[n].el;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ax = ra.left + ra.width / 2, ay = ra.top + ra.height / 2, bx = rb.left + rb.width / 2, by = rb.top + rb.height / 2;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const ta = edge(ra.width / 2 + 12, ra.height / 2 + 10, dx, dy), tb = edge(rb.width / 2 + 12, rb.height / 2 + 10, dx, dy);
    const x1 = ax + dx * ta, y1 = ay + dy * ta, x2 = bx - dx * tb, y2 = by - dy * tb;
    const l2 = Math.hypot(x2 - x1, y2 - y1), wob = (i % 2 ? 1 : -1) * 0.09 * l2, nx = -uy, ny = ux;
    p.setAttribute('d', `M${x1},${y1} C${x1 + (x2 - x1) * 0.33 + nx * wob},${y1 + (y2 - y1) * 0.33 + ny * wob} ${x1 + (x2 - x1) * 0.66 - nx * wob * 0.8},${y1 + (y2 - y1) * 0.66 - ny * wob * 0.8} ${x2},${y2}`);
    const L = p.getTotalLength(); p.style.strokeDasharray = L;
    let prog = 1;
    if (age === -1) prog = Math.max(0, Math.min(1, (pos - (nextStart - CH_LEAD)) / CH_LEAD));
    p.style.strokeDashoffset = L * (1 - prog);
    const op = prog > 0 ? 0.9 * (age === -1 ? lineEls[i].o : Math.min(lineEls[i].o, lineEls[n].o)) : 0;
    p.style.opacity = op;
    p.dots[0].setAttribute('cx', x1); p.dots[0].setAttribute('cy', y1); p.dots[1].setAttribute('cx', x2); p.dots[1].setAttribute('cy', y2);
    p.dots[0].style.opacity = op; p.dots[1].style.opacity = prog >= 0.98 ? op : 0;
  });
}
// one handwriting accent word per line: the longest word (min 4 letters), first on ties
function accentIndex(words) {
  let best = -1, len = 3;
  words.forEach((w, i) => { const n = w.text.replace(/[^\p{L}]/gu, '').length; if (n > len) { len = n; best = i; } });
  return best;
}
function buildDom() {
  wall.innerHTML = ''; lineEls = [];
  if (!model || !model.lines || !model.lines.length) {
    emptyEl.textContent = emptyText();
    emptyEl.style.display = 'flex'; return;
  }
  emptyEl.style.display = 'none';
  const frag = document.createDocumentFragment();
  model.lines.forEach((line) => {
    const el = document.createElement('div');
    el.className = 'line far';
    if (line.words) {
      const accent = settings.mode === 'chain' ? accentIndex(line.words) : -1;
      line.words.forEach((w, wi) => {
        const span = document.createElement('span');
        span.className = 'word' + (wi === accent ? ' script' : '');
        const fill = document.createElement('span');
        fill.className = 'fill'; fill.textContent = w.text;
        span.textContent = w.text;
        span.appendChild(fill);
        if (settings.mode === 'visual') {
          const ic = iconFor(w.text);
          if (ic) { const i = document.createElement('span'); i.className = 'icon'; i.textContent = ic; span.appendChild(i); }
        }
        el.appendChild(span);
        if (!/\s$/.test(w.text)) el.appendChild(document.createTextNode(' '));
      });
    } else {
      el.textContent = line.text;
    }
    frag.appendChild(el);
    const nch = (line.text || '').length; if (nch > 28) el.style.fontSize = Math.max(2.4, 4.2 * Math.sqrt(28 / nch)) + 'vw'; // long lines get smaller type so they never crowd neighbours
    lineEls.push({ el, line, wordEls: line.words ? [...el.querySelectorAll('.word')] : [] });
  });
  wall.appendChild(frag);
}

function currentPosition() {
  if (!playback.playing) return playback.positionMs;
  return playback.positionMs + (Date.now() - playback.positionAt);
}

function render() {
  if (!lineEls.length || !model || model.unsynced) return;
  const pos = currentPosition();
  let cur = -1;
  for (let i = 0; i < lineEls.length; i++) {
    if (lineEls[i].line.startMs <= pos) cur = i; else break;
  }
  const gap = window.innerHeight * 0.16;
  if (settings.mode === 'chain') {
    if (chainPaths.length !== lineEls.length - 1) chainBuild();
    chainRender(pos, cur);
    lineEls.forEach(le => wordProgress(le, pos));
    return;
  }
  lineEls.forEach((le, i) => {
    const d = i - cur;
    const { el } = le;
    if (Math.abs(d) > 6) { el.className = 'line far'; return; }
    el.className = 'line ' + (d === 0 ? 'current' : d < 0 ? 'past' : 'next');
    if (settings.mode === 'ship') {
      const z = -Math.abs(d) * 140;
      const x = (d % 2 === 0 ? 1 : -1) * Math.min(40, Math.abs(d) * 12);
      el.style.transform = `translate(-50%,-50%) translate3d(${x}px, ${d * gap}px, ${z}px) rotateX(${d * -6}deg)`;
    } else if (settings.mode === 'fisheye') {
      const scale = Math.max(0.7, 1.25 - Math.abs(d) * 0.18);
      el.style.transform = `translate(-50%,-50%) translateY(${d * gap * 0.85}px) scale(${scale})`;
      el.style.filter = Math.abs(d) > 2 ? `blur(${(Math.abs(d) - 2) * 1.5}px)` : 'none';
    } else {
      el.style.transform = `translate(-50%,-50%) translateY(${d * gap}px)`;
    }
    wordProgress(le, pos);
  });
}
function wordProgress(le, pos) {
  {
    if (le.wordEls.length) {
      le.line.words.forEach((w, j) => {
        const wEl = le.wordEls[j];
        const fill = wEl.querySelector('.fill');
        let p = 0;
        if (pos >= w.endMs) p = 1;
        else if (pos > w.startMs) p = (pos - w.startMs) / Math.max(1, w.endMs - w.startMs);
        fill.style.width = (p * 100).toFixed(1) + '%';
        wEl.classList.toggle('sung', p >= 1);
      });
    }
  }
}

function paletteFromArt(imgEl) {
  try {
    const c = document.createElement('canvas');
    const s = 24; c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, s, s);
    const d = ctx.getImageData(0, 0, s, s).data;
    let best = [0, 0, 0], bestScore = -1, bright = [255, 255, 255], brightScore = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const score = sat * (1 - Math.abs(lum - 128) / 160);
      if (score > bestScore) { bestScore = score; best = [r, g, b]; }
      if (lum > 150 && lum > brightScore) { brightScore = lum; bright = [r, g, b]; }
    }
    // mute the dominant color toward its own luminance so the palette stays restrained
    const avg = (best[0] + best[1] + best[2]) / 3;
    const muted = best.map(v => v * 0.75 + avg * 0.25);
    const toHex = a => '#' + a.map(v => Math.round(Math.min(255, v)).toString(16).padStart(2, '0')).join('');
    return { lyric: toHex(muted.map(v => v * 0.8 + 62)), highlight: toHex(bright), secondary: toHex(muted.map(v => v * 0.45 + 10)) };
  } catch { return null; }
}

async function resolveArt(track) {
  if (track.artUrl) return track.artUrl;
  try {
    const q = encodeURIComponent((track.title || '') + ' ' + (track.artist || ''));
    const r = await fetch('https://itunes.apple.com/search?media=music&limit=1&term=' + q);
    const j = await r.json();
    const u = j.results && j.results[0] && j.results[0].artworkUrl100;
    return u ? u.replace('100x100bb', '300x300bb') : null;
  } catch { return null; }
}

function applyTrack({ track }) {
  currentTrack = track;
  if (!model || !model.lines || !model.lines.length) {
    emptyEl.textContent = emptyText();
  }
  npTitle.textContent = track.title || '';
  npArtist.textContent = track.artist || '';
  lyrSource.textContent = '';
  resolveArt(track).then(url => {
    if (url) {
      artEl.style.display = 'block';
      artEl.crossOrigin = 'anonymous';
      artEl.onload = () => {
        if (settings.colorMode === 'auto') {
          const p = paletteFromArt(artEl);
          if (p) applyColors({ lyric: p.lyric, highlight: p.highlight, secondary: p.secondary });
        }
      };
      artEl.src = url;
    } else {
      artEl.style.display = 'none';
    }
  });
}

function applyLyrics({ lyrics, error }) {
  lyricsFetchError = !!error;
  model = lyrics;
  if (lyrics) {
    lyrSource.textContent = lyrics.wordLevel ? 'word-by-word · ' + lyrics.source
      : lyrics.unsynced ? 'unsynced · ' + lyrics.source
      : 'line-synced (words estimated) · ' + lyrics.source;
  } else {
    lyrSource.textContent = lyricsFetchError ? 'lyrics service unreachable' : 'no lyrics found';
  }
  buildDom();
}

if (window.verso) {
  window.verso.getState().then(st => {
    settings = st.settings; applyColors(st.settings.colors); applyMode();
    if (st.track) applyTrack({ track: st.track });
    if (st.lyrics || st.lyricsError) applyLyrics({ lyrics: st.lyrics, error: st.lyricsError });
    if (st.tick) playback = st.tick;
  });
  window.verso.onSettings(s => { settings = s; applyColors(s.colors); applyMode(); });
  window.verso.onTrack(applyTrack);
  window.verso.onLyrics(applyLyrics);
  window.verso.onTick(t => { playback = t; });
} else {
  // dev preview in a plain browser
  emptyEl.textContent = 'VERSO dev preview';
}

function loop() { render(); requestAnimationFrame(loop); }
loop();


// on-screen window buttons: shown while the mouse moves, hidden when idle
(function () {
  let t = null;
  const wake = () => { document.documentElement.classList.remove('idle'); clearTimeout(t); t = setTimeout(() => document.documentElement.classList.add('idle'), 2500); };
  window.addEventListener('mousemove', wake); window.addEventListener('mousedown', wake); wake();
  const send = a => window.verso && window.verso.win && window.verso.win(a);
  document.getElementById('b-min').onclick = () => send('minimize');
  document.getElementById('b-fs').onclick = () => send('toggle-fullscreen');
})();
