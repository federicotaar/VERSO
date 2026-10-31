const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('verso', {
  onSettings: cb => ipcRenderer.on('settings', (_e, s) => cb(s)),
  onTrack: cb => ipcRenderer.on('track', (_e, t) => cb(t)),
  onLyrics: cb => ipcRenderer.on('lyrics', (_e, l) => cb(l)),
  onTick: cb => ipcRenderer.on('tick', (_e, t) => cb(t)),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getState: () => ipcRenderer.invoke('get-state'),
  setTokens: t => ipcRenderer.invoke('set-tokens', t),
  setColors: c => ipcRenderer.invoke('set-colors', c)
});
