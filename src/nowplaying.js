// Now-playing source: reads the OS media session (GSMTC on Windows, MPRIS on Linux)
// through now-playing-media's prebuilt Node-API binaries.
// The package is pure ESM and Electron 33 (Node 20) cannot require() ESM,
// so it is loaded with a lazy dynamic import().
let npmApiPromise = null;
let loadError = null;

function load() {
  if (!npmApiPromise) {
    npmApiPromise = import('now-playing-media')
      .then(m => (m && m.default) || m)
      .catch(e => { loadError = e; return null; });
  }
  return npmApiPromise;
}

async function poll() {
  const npmApi = await load();
  if (!npmApi) return { ok: false, error: String(loadError || 'now-playing-media unavailable') };
  try {
    const s = await npmApi.current();
    if (!s || !s.track) return { ok: true, playing: false, track: null };
    const t = s.track;
    return {
      ok: true,
      playing: (s.playback && String(s.playback.status).toLowerCase()) === 'playing',
      positionMs: (s.playback && typeof s.playback.positionMs === 'number') ? s.playback.positionMs : null,
      track: {
        title: t.title || '',
        artist: t.artist || t.albumArtist || '',
        album: t.album || '',
        durationMs: t.durationMs || null,
        artUrl: t.artworkUrl || (t.artwork && t.artwork.url) || null,
        source: (s.source && (s.source.name || s.source.id)) || ''
      }
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

module.exports = { poll };
