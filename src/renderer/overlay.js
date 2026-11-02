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
  document.documentElement.classList.toggle('fs', !!settings.fullscreen);
  stage.classList.toggle('fs', !!settings.fullscreen);
  render();
}
const chainSvg = document.getElementById('chain-svg');
let chainPaths = [];
const SVGNS = 'http://www.w3.org/2000/svg';
function chainBuild() {
  chainSvg.innerHTML = ''; chainPaths = [];
  for (let i = 0; i < lineEls.length - 1; i++) {
    const p = document.createElementNS(SVGNS, 'path'); p.style.opacity = 0; chainSvg.appendChild(p); chainPaths.push(p);
  }
}
const CH_PAST = 0.4, CH_LEAD = 1100;
function chainX(i, W) { return (i % 2 === 0 ? -1 : 1) * W * 0.17; }
function chainRender(pos, cur) {
  const W = window.innerWidth, H = window.innerHeight, step = H * 0.3;
  const cx = W / 2, cy = H / 2;
  const nextStart = cur + 1 < lineEls.length ? lineEls[cur + 1].line.startMs : Infinity;
  lineEls.forEach((le, i) => {
    const d = i - cur, el = le.el;
    const scale = d === 0 ? 1 : d < 0 ? CH_PAST : 0.8;
    const x = chainX(i, W), y = d * step;
    el.style.transform = `translate(-50%,-50%) translate(${x}px, ${y}px) scale(${scale})`;
    el.className = 'line ' + (d === 0 ? 'current' : d < 0 ? 'past' : 'chain-hide');
    if (d < -2 || d > 1) el.style.opacity = 0; else el.style.opacity = '';
  });
  chainPaths.forEach((p, i) => {
    const d = i - cur; // connector from line i to i+1
    if (d < -2 || d > 0) { p.style.opacity = 0; return; }
    const a = lineEls[i].el, b = lineEls[i + 1].el;
    const sa = d === 0 ? 1 : CH_PAST, sb = d === 0 ? 1 : d === -1 ? 1 : CH_PAST;
    // end of connector sits at top of next line (full size once it is current)
    const x1 = cx + chainX(i, W), y1 = cy + d * step + (a.offsetHeight * sa) / 2 + 10;
    const x2 = cx + chainX(i + 1, W), y2 = cy + (d + 1) * step - (b.offsetHeight * (d === 0 ? 1 : d === -1 ? 1 : CH_PAST)) / 2 - 10;
    const my = (y1 + y2) / 2;
    p.setAttribute('d', `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`);
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    let prog = 1;
    if (d === 0) prog = Math.max(0, Math.min(1, (pos - (nextStart - CH_LEAD)) / CH_LEAD));
    p.style.strokeDashoffset = len * (1 - prog);
    p.style.opacity = d === 0 ? (prog > 0 ? 1 : 0) : 0.35;
  });
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
      line.words.forEach(w => {
        const span = document.createElement('span');
        span.className = 'word';
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

