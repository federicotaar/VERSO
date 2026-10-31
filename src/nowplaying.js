// Now-playing source: reads the OS media session (GSMTC on Windows, MPRIS on Linux)
// through now-playing-media's prebuilt Node-API binaries.
let npmApi = null;
let loadError = null;
try {
  npmApi = require('now-playing-media');
} catch (e) {
  loadError = e;
}

async function poll() {
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
