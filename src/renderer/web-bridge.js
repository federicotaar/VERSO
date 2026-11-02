// Browser version of the preload bridge: same window.verso interface, fed by the local Verso app (read-only).
(function () {
  const subs = { settings: [], track: [], lyrics: [], tick: [] };
  const emit = (k, v) => subs[k].forEach(f => f(v));
  const norm = s => ({ ...s, fullscreen: false });
  const status = document.createElement('div');
  status.style.cssText = 'position:fixed;left:0;right:0;bottom:3vh;text-align:center;font:14px system-ui;color:#6b7688;z-index:9;pointer-events:none';
  document.body.appendChild(status);
  const say = t => { status.textContent = t || ''; };
  window.verso = {
    getState: () => fetch('/api/state').then(r => r.json()).then(s => { s.settings = norm(s.settings); return s; }),
    getSettings: () => fetch('/api/state').then(r => r.json()).then(s => norm(s.settings)),
    onSettings: f => subs.settings.push(f), onTrack: f => subs.track.push(f),
    onLyrics: f => subs.lyrics.push(f), onTick: f => subs.tick.push(f),
    win: () => {}, setColors: () => Promise.resolve({})
  };
  function connect() {
    const es = new EventSource('/api/events');
    es.onopen = () => say('');
    es.addEventListener('settings', e => emit('settings', norm(JSON.parse(e.data))));
    es.addEventListener('track', e => emit('track', JSON.parse(e.data)));
    es.addEventListener('lyrics', e => emit('lyrics', JSON.parse(e.data)));
    es.addEventListener('tick', e => { const t = JSON.parse(e.data); say(''); emit('tick', t); });
    es.onerror = () => say('Verso is not running on this PC. Open the Verso app (tray icon) and reload.');
  }
  connect();
  // F toggles browser fullscreen (F11 works natively)
  window.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    }
  });
})();
