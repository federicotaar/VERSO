// Preload bridge: the only surface the overlay page can reach.
// The renderer has no Node access; these contextBridge methods map IPC
// channels (settings, track, lyrics, tick, window controls, colors) to
// plain callbacks. Keep this list minimal on purpose.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('verso', {
  onSettings: cb => ipcRenderer.on('settings', (_e, s) => cb(s)),
  onTrack: cb => ipcRenderer.on('track', (_e, t) => cb(t)),
  onLyrics: cb => ipcRenderer.on('lyrics', (_e, l) => cb(l)),
  onTick: cb => ipcRenderer.on('tick', (_e, t) => cb(t)),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getState: () => ipcRenderer.invoke('get-state'),
  win: a => ipcRenderer.send('win', a),
  setColors: c => ipcRenderer.invoke('set-colors', c)
});
