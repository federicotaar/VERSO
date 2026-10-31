// VERSO - word-by-word lyrics overlay for Ubuntu and Windows.
// Tray app: frameless always-on-top overlay + optional fullscreen mode.
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, powerSaveBlocker, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const nowplaying = require('./nowplaying');
const { getLyrics } = require('./lyrics');

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(s) { fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2)); }

const DEFAULTS = {
  mode: 'ship',            // ship | fisheye | visual | plain
  colorMode: 'auto',       // auto (album art) | manual
  colors: { lyric: '#9fb4ff', highlight: '#ffffff', secondary: '#5a6b9e' },
  clickThrough: true,
  keepAwake: true,
  showWhenPaused: true,
  appleUserToken: '',
  appleDevToken: '',
  appleStorefront: 'it'
};

let settings = loadSettings();
let overlay = null, tray = null, blockerId = null;
let lastTrackKey = null, lastLyricsSent = null;
let lastState = { playing: false, positionMs: 0, at: Date.now(), track: null };

function createOverlay() {
  const disp = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    width: Math.round(disp.workAreaSize.width * 0.7),
    height: Math.round(disp.workAreaSize.height * 0.45),
    x: Math.round(disp.workAreaSize.width * 0.15),
    y: Math.round(disp.workAreaSize.height * 0.45),
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    resizable: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
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
    { label: 'Style: Ship', type: 'radio', checked: settings.mode === 'ship', click: () => setMode('ship') },
    { label: 'Style: Fisheye', type: 'radio', checked: settings.mode === 'fisheye', click: () => setMode('fisheye') },
    { label: 'Style: Visual (icons)', type: 'radio', checked: settings.mode === 'visual', click: () => setMode('visual') },
    { label: 'Style: Plain karaoke', type: 'radio', checked: settings.mode === 'plain', click: () => setMode('plain') },
    { type: 'separator' },
    { label: 'Palette from album art', type: 'checkbox', checked: settings.colorMode === 'auto', click: i => { settings.colorMode = i.checked ? 'auto' : 'manual'; saveSettings(settings); pushSettings(); } },
    { label: 'Click-through (lock overlay)', type: 'checkbox', checked: settings.clickThrough, click: i => { settings.clickThrough = i.checked; saveSettings(settings); applyClickThrough(); rebuildTray(); } },
    { label: 'Keep display awake while playing', type: 'checkbox', checked: settings.keepAwake, click: i => { settings.keepAwake = i.checked; saveSettings(settings); applyKeepAwake(lastState.playing); } },
    { label: 'Show when paused', type: 'checkbox', checked: settings.showWhenPaused, click: i => { settings.showWhenPaused = i.checked; saveSettings(settings); rebuildTray(); } },
    { type: 'separator' },
    { label: 'Fullscreen mode', accelerator: 'CmdOrCtrl+Shift+F', click: toggleFullscreen },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(ctx);
}

function setMode(m) { settings.mode = m; saveSettings(settings); pushSettings(); rebuildTray(); }
function applyClickThrough() { if (overlay) overlay.setIgnoreMouseEvents(settings.clickThrough, { forward: true }); }
function applyKeepAwake(playing) {
  if (settings.keepAwake && playing) {
    if (blockerId === null) blockerId = powerSaveBlocker.start('prevent-display-sleep');
  } else if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId); blockerId = null;
  }
}

function toggleFullscreen() {
  if (!overlay) return;
  overlay.setFullScreen(!overlay.isFullScreen());
}

function pushSettings() {
  if (overlay) overlay.webContents.send('settings', publicSettings());
}
function publicSettings() {
  const { appleUserToken, appleDevToken, ...rest } = settings;
  return { ...rest, appleWordLevel: Boolean(appleUserToken && appleDevToken) };
}

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
  if (key && key !== lastTrackKey) {
    lastTrackKey = key; lastLyricsSent = null;
    if (overlay) overlay.webContents.send('track', { track: r.track });
    const lyrics = await getLyrics(r.track, settings).catch(() => null);
    lastLyricsSent = lyrics;
    if (overlay) overlay.webContents.send('lyrics', { track: r.track, lyrics });
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
  schedule(250);
}
let timer = null;
function schedule(ms) { clearTimeout(timer); timer = setTimeout(pollLoop, ms); }

ipcMain.handle('get-settings', () => publicSettings());
ipcMain.handle('set-tokens', (_e, t) => {
  settings.appleUserToken = t.userToken || '';
  settings.appleDevToken = t.devToken || '';
  settings.appleStorefront = t.storefront || 'it';
  saveSettings(settings); lastTrackKey = null; // refetch lyrics with word level
  return publicSettings();
});
ipcMain.handle('set-colors', (_e, colors) => {
  settings.colors = { ...settings.colors, ...colors }; settings.colorMode = 'manual';
  saveSettings(settings); pushSettings(); rebuildTray(); return publicSettings();
});
ipcMain.on('palette', (_e, palette) => {
  if (settings.colorMode === 'auto' && palette && overlay) overlay.webContents.send('palette-applied', palette);
});

app.whenReady().then(() => {
  createOverlay(); rebuildTray();
  globalShortcut.register('CmdOrCtrl+Shift+L', () => {
    settings.clickThrough = !settings.clickThrough; saveSettings(settings); applyClickThrough(); rebuildTray();
  });
  globalShortcut.register('CmdOrCtrl+Shift+F', toggleFullscreen);
  globalShortcut.register('CmdOrCtrl+Shift+M', () => {
    const modes = ['ship', 'fisheye', 'visual', 'plain'];
    setMode(modes[(modes.indexOf(settings.mode) + 1) % modes.length]);
  });
  pollLoop();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
});
app.on('window-all-closed', e => e.preventDefault()); // tray app

// 16x16 simple note icon
const TRAY_ICON_DATAURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0AEYBxVSFAcMDAwMIwqJBgOAwMDA8OoQoLhMAAA9//+AT2rp1MAAAAASUVORK5CYII=';
