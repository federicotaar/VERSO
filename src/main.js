// VERSO - fullscreen line-synced lyrics for macOS, Ubuntu and Windows.
// Tray app: frameless always-on-top overlay + optional fullscreen mode.
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, powerSaveBlocker, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const DEMO = !!process.env.VERSO_DEMO;
const nowplaying = DEMO ? require('./demo') : require('./nowplaying');
const { getLyrics } = require('./lyrics');
const web = require('./webserver');

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const SETTINGS_VERSION = 3;
function loadSettings() {
  let raw, s;
  try { raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); s = { ...DEFAULTS, ...raw }; }
  catch { return { ...DEFAULTS, settingsVersion: SETTINGS_VERSION }; }
  // upgrade from <0.1.1: apply the new default look once (chain + fullscreen), keep every other setting
  if ((raw.settingsVersion || 1) < SETTINGS_VERSION) {
    if ((raw.settingsVersion || 1) < 2) s.mode = 'chain';
    s.fullscreen = true; s.settingsVersion = SETTINGS_VERSION;
    try { fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2)); } catch {}
  }
  return s;
}
function saveSettings(s) { fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2)); }

const DEFAULTS = {
  mode: 'chain',           // chain | ship | fisheye | visual | plain
  fullscreen: true,        // true edge-to-edge, matte black (no window frame); Esc or Ctrl/Cmd+Shift+F leaves it
  colorMode: 'auto',       // auto (album art) | manual
  colors: { lyric: '#aab4c8', highlight: '#ffffff', secondary: '#6b7688' },
  clickThrough: true,
  keepAwake: true,
  showWhenPaused: true
};

let settings = loadSettings();
let overlay = null, tray = null, blockerId = null;
let lastTrackKey = null, lastLyricsSent = null;
let lastState = { playing: false, positionMs: 0, at: Date.now(), track: null };

function logLine(msg) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'verso.log'), new Date().toISOString() + ' ' + msg + '\n'); } catch {}
}
function createOverlay() {
  const disp = screen.getPrimaryDisplay();
  const common = {
    backgroundColor: '#000000', transparent: false, hasShadow: false, autoHideMenuBar: true, show: false,
    title: 'Verso', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  };
  if (settings.fullscreen) {
    overlay = new BrowserWindow({
      ...common, x: disp.bounds.x, y: disp.bounds.y, width: disp.bounds.width, height: disp.bounds.height,
      fullscreen: true, frame: false, resizable: false, skipTaskbar: false
    });
    overlay.setMenuBarVisibility(false);
    overlay.once('ready-to-show', () => {
      overlay.setFullScreen(true); overlay.show();
      // some Linux desktops ignore the first request: verify and fall back to full display bounds
      setTimeout(() => {
        if (!overlay) return;
        const ok = overlay.isFullScreen();
        logLine('fullscreen requested, isFullScreen=' + ok + ' session=' + (process.env.XDG_SESSION_TYPE || '?') + ' desktop=' + (process.env.XDG_CURRENT_DESKTOP || '?'));
        if (!ok) { overlay.setBounds(disp.bounds); overlay.setFullScreen(true); }
      }, 1500);
    });
  } else {
    // normal opaque window with the system title bar (minimize / maximize / close)
    overlay = new BrowserWindow({
      ...common, width: Math.round(disp.workAreaSize.width * 0.7), height: Math.round(disp.workAreaSize.height * 0.7),
      frame: true, resizable: true, minimizable: true, maximizable: true, fullscreenable: true, skipTaskbar: false
    });
    overlay.setMenuBarVisibility(false);
    overlay.once('ready-to-show', () => overlay.show());
  }
  overlay.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && settings.fullscreen) { e.preventDefault(); toggleFullscreen(); }
    if (input.type === 'keyDown' && input.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
  });
  overlay.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlay.on('closed', () => { overlay = null; });
}

function rebuildTray() {
  if (!tray) {
    const img = nativeImage.createFromDataURL(TRAY_ICON_DATAURL);
    tray = new Tray(img);
    tray.setToolTip('VERSO - lyrics overlay');
  }
  const ctx = Menu.buildFromTemplate([
    { label: 'VERSO', enabled: false },
    { type: 'separator' },
    { label: 'Style: Chain (connected lines)', type: 'radio', checked: settings.mode === 'chain', click: () => setMode('chain') },
    { label: 'Style: Ship', type: 'radio', checked: settings.mode === 'ship', click: () => setMode('ship') },
    { label: 'Style: Fisheye', type: 'radio', checked: settings.mode === 'fisheye', click: () => setMode('fisheye') },
    { label: 'Style: Visual (icons)', type: 'radio', checked: settings.mode === 'visual', click: () => setMode('visual') },
    { label: 'Style: Plain karaoke', type: 'radio', checked: settings.mode === 'plain', click: () => setMode('plain') },
    { type: 'separator' },
    { label: 'Palette from album art', type: 'checkbox', checked: settings.colorMode === 'auto', click: i => { settings.colorMode = i.checked ? 'auto' : 'manual'; saveSettings(settings); pushSettings(); } },
        { label: 'Keep display awake while playing', type: 'checkbox', checked: settings.keepAwake, click: i => { settings.keepAwake = i.checked; saveSettings(settings); applyKeepAwake(lastState.playing); } },
    { label: 'Show when paused', type: 'checkbox', checked: settings.showWhenPaused, click: i => { settings.showWhenPaused = i.checked; saveSettings(settings); rebuildTray(); } },
    { type: 'separator' },
    { label: 'Show window / bring to front', click: () => { if (overlay) { overlay.show(); overlay.focus(); } } },
    { label: 'Open lyrics in browser (this PC only)', click: openWeb },
    { label: 'Fullscreen (matte black)', type: 'checkbox', checked: !!settings.fullscreen, accelerator: 'CmdOrCtrl+Shift+F', click: toggleFullscreen },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(ctx);
}

function openWebNoBrowser() { // test hook only
  web.start({ log: logLine, getState: () => ({ settings: publicSettings(), track: lastState.track, lyrics: lastLyricsSent, lyricsError: lastLyricsError,
    tick: { playing: lastState.playing, positionMs: lastState.positionMs, positionAt: lastState.at, track: lastState.track } }) });
}
async function openWeb() {
  const u = await web.start({
    log: logLine,
    getState: () => ({ settings: publicSettings(), track: lastState.track, lyrics: lastLyricsSent, lyricsError: lastLyricsError,
      tick: { playing: lastState.playing, positionMs: lastState.positionMs, positionAt: lastState.at, track: lastState.track } })
  });
  if (u) shell.openExternal(u);
  else logLine('browser page could not start (port ' + web.PORT + ' busy?)');
}
function setMode(m) { settings.mode = m; saveSettings(settings); pushSettings(); rebuildTray(); }
function applyClickThrough() {} // the window is now always opaque and clickable; kept so old settings/shortcuts do not break
function applyKeepAwake(playing) {
  if (settings.keepAwake && playing) {
    if (blockerId === null) blockerId = powerSaveBlocker.start('prevent-display-sleep');
  } else if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId); blockerId = null;
  }
}

function toggleFullscreen() {
  // transparency cannot change on a live window, so rebuild it in the other form
  settings.fullscreen = !settings.fullscreen; saveSettings(settings);
  const old = overlay; overlay = null;
  if (old) old.destroy();
  createOverlay(); rebuildTray();
}

function pushSettings() {
  if (overlay) overlay.webContents.send('settings', publicSettings());
  web.broadcast('settings', publicSettings());
}
function publicSettings() { return { ...settings }; }

function trackKey(t) { return t ? `${t.title}|${t.artist}|${t.album}` : null; }

async function pollLoop() {
  const r = await nowplaying.poll();
  if (!r.ok) return schedule(2000);
  const wasPlaying = lastState.playing;
  lastState = {
    playing: r.playing,
    positionMs: r.positionMs == null ? lastState.positionMs : r.positionMs,
    at: Date.now(),
    track: r.track || lastState.track
  };
  applyKeepAwake(r.playing);

  const key = trackKey(r.track);
  const retryDue = lastLyricsError && (Date.now() - lastLyricsAttempt > lyricsRetryDelayMs());
  if (key && (key !== lastTrackKey || retryDue)) {
    lastTrackKey = key; lastLyricsSent = null;
    if (overlay) overlay.webContents.send('track', { track: r.track });
    web.broadcast('track', { track: r.track });
    let lyrics = null; let lerr = false;
    if (DEMO) { lyrics = require('./demo').demoLyrics(); }
    else {
      try {
        lyrics = await getLyrics(r.track, settings);
        lyricsFailures = 0; lyricsRetryAfterMs = 0;
      } catch (e) {
        lerr = true;
        lyricsFailures++;
        lyricsRetryAfterMs = (e && e.retryAfterMs) || 0;
      }
    }
    lastLyricsSent = lyrics; lastLyricsError = lerr; lastLyricsAttempt = Date.now();
    if (overlay) overlay.webContents.send('lyrics', { track: r.track, lyrics, error: lerr });
    web.broadcast('lyrics', { track: r.track, lyrics, error: lerr });
  }
  if (overlay) {
    const visible = r.playing || settings.showWhenPaused || wasPlaying;
    if (!visible && overlay.isVisible()) overlay.hide();
    else if (visible && !overlay.isVisible()) overlay.show();
    overlay.webContents.send('tick', {
      playing: r.playing, positionMs: lastState.positionMs,
      positionAt: lastState.at, track: r.track
    });
  }
  web.broadcast('tick', { playing: r.playing, positionMs: lastState.positionMs, positionAt: lastState.at, track: r.track });
  schedule(process.platform === 'darwin' ? 1000 : 250); // Mac backend launches a short-lived system process.
}
let lastLyricsError = false;
let lastLyricsAttempt = 0;
let lyricsFailures = 0;
let lyricsRetryAfterMs = 0;
function lyricsRetryDelayMs() {
  if (lyricsRetryAfterMs) return lyricsRetryAfterMs;
  // exponential backoff: 20s, 40s, 80s, ... capped at 5 minutes
  return Math.min(20000 * Math.pow(2, Math.max(0, lyricsFailures - 1)), 300000);
}
let timer = null;
function schedule(ms) { clearTimeout(timer); timer = setTimeout(pollLoop, ms); }

ipcMain.on('win', (_e, action) => {
  if (!overlay) return;
  if (action === 'minimize') overlay.minimize();
  else if (action === 'toggle-fullscreen') toggleFullscreen();
});
ipcMain.handle('get-settings', () => publicSettings());
ipcMain.handle('get-state', () => ({
  settings: publicSettings(),
  track: lastState.track,
  lyrics: lastLyricsSent,
  lyricsError: lastLyricsError,
  tick: { playing: lastState.playing, positionMs: lastState.positionMs, positionAt: lastState.at, track: lastState.track }
}));
ipcMain.handle('set-colors', (_e, colors) => {
  settings.colors = { ...settings.colors, ...colors }; settings.colorMode = 'manual';
  saveSettings(settings); pushSettings(); rebuildTray(); return publicSettings();
});
ipcMain.on('palette', (_e, palette) => {
  if (settings.colorMode === 'auto' && palette && overlay) overlay.webContents.send('palette-applied', palette);
});

if (!app.requestSingleInstanceLock()) { app.quit(); }
else app.on('second-instance', () => { if (overlay) { if (overlay.isMinimized()) overlay.restore(); overlay.show(); overlay.focus(); } });
app.whenReady().then(() => {
  logLine('start v' + app.getVersion() + ' settings fullscreen=' + settings.fullscreen + ' mode=' + settings.mode);
  createOverlay(); rebuildTray();
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Verso', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' },
    { label: 'Window', submenu: [{ role: 'minimize' }, { label: 'Fullscreen', accelerator: 'CmdOrCtrl+Shift+F', click: toggleFullscreen }, { label: 'Show Verso', click: () => { if (overlay) { overlay.show(); overlay.focus(); } else createOverlay(); } }] }
  ]));
  globalShortcut.register('CmdOrCtrl+Shift+L', () => {
    settings.clickThrough = !settings.clickThrough; saveSettings(settings); applyClickThrough(); rebuildTray();
  });
  globalShortcut.register('CmdOrCtrl+Shift+F', toggleFullscreen);
  globalShortcut.register('CmdOrCtrl+Shift+M', () => {
    const modes = ['chain', 'ship', 'fisheye', 'visual', 'plain'];
    setMode(modes[(modes.indexOf(settings.mode) + 1) % modes.length]);
  });
  pollLoop();
  if (process.env.VERSO_WEB_AUTOSTART) openWebNoBrowser();
  if (process.env.VERSO_SHOT) {
    setTimeout(async () => {
      try {
        const img = await overlay.webContents.capturePage();
        require('fs').writeFileSync(process.env.VERSO_SHOT, img.toPNG());
      } catch (e) { console.error('shot failed', e); }
      app.exit(0);
    }, parseInt(process.env.VERSO_SHOT_MS || '9000', 10));
  }
});

app.on('will-quit', () => {
  web.stop();
  globalShortcut.unregisterAll();
  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
});
app.on('window-all-closed', e => e.preventDefault()); // tray app

// 16x16 simple note icon
const TRAY_ICON_DATAURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0AEYBxVSFAcMDAwMIwqJBgOAwMDA8OoQoLhMAAA9//+AT2rp1MAAAAASUVORK5CYII=';


app.on('activate', () => {
  if (!app.isReady()) return;
  if (!overlay) createOverlay();
  else { if (overlay.isMinimized()) overlay.restore(); overlay.show(); overlay.focus(); }
});
