// LRCLIB provider: free, key-less synced-lyrics API built for third-party clients.
// Line-level timings only (no word-level). https://lrclib.net/docs
const https = require('https');

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'VERSO v0.1 (personal lyrics overlay)' } }, res => {
      if (res.statusCode === 404) { res.resume(); return resolve(null); }
      if (res.statusCode !== 200) {
        const err = new Error('HTTP ' + res.statusCode);
        const ra = res.headers['retry-after'];
        if (ra) {
          // Retry-After is a minimum wait set by the server (delta-seconds or HTTP-date); never shorten it
          const secs = parseInt(ra, 10);
          if (!isNaN(secs)) err.retryAfterMs = Math.max(0, secs * 1000);
          else {
            const t = Date.parse(ra);
            if (!isNaN(t)) err.retryAfterMs = Math.max(0, t - Date.now());
          }
        }
        res.resume(); return reject(err);
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function fetchLyrics({ title, artist, album, durationMs }) {
  const q = new URLSearchParams({
    track_name: title || '',
    artist_name: artist || '',
    album_name: album || ''
  });
  if (durationMs) q.set('duration', String(Math.round(durationMs / 1000)));
  const rec = await getJson('https://lrclib.net/api/get?' + q.toString());
  if (!rec) return null;
  if (rec.syncedLyrics) return { kind: 'lrc', lrc: rec.syncedLyrics, source: 'lrclib', wordLevel: false };
  if (rec.plainLyrics) return { kind: 'plain', plain: rec.plainLyrics, source: 'lrclib', wordLevel: false };
  return null;
}

module.exports = { fetchLyrics };
