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

// Normalise a title/artist for comparison only: case, accents, punctuation,
// "(feat. X)", and release-edition suffixes such as "- Remastered 2011" are ignored.
function norm(str) {
  return String(str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|remix|mono|stereo|live|radio edit|single version|album version)\b.*$/, '')
    .replace(/[\(\[](?:feat|ft|with)\.?[^\)\]]*[\)\]]/g, '')
    .replace(/[\(\[][^\)\]]*(?:remaster|version|edit|mix)[^\)\]]*[\)\]]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Pick a result only when title and artist match after normalisation, it has
// timed lyrics, and (when the player reports a duration) its length is within
// 3 s. Anything weaker returns null: no lyrics beat the wrong song's lyrics.
function pickBest(track, results, maxDiffSec = 3) {
  const wantT = norm(track.title), wantA = norm(track.artist);
  if (!wantT || !wantA || !Array.isArray(results)) return null;
  const wantDur = track.durationMs ? track.durationMs / 1000 : null;
  const ok = results.filter(r => r && r.syncedLyrics && !r.instrumental
    && norm(r.trackName) === wantT && norm(r.artistName) === wantA
    && (wantDur === null || (typeof r.duration === 'number' && Math.abs(r.duration - wantDur) <= maxDiffSec)));
  if (!ok.length) return null;
  if (wantDur !== null) ok.sort((a, b) => Math.abs(a.duration - wantDur) - Math.abs(b.duration - wantDur));
  return ok[0];
}

async function fetchLyrics({ title, artist, album, durationMs }, http = getJson) {
  const q = new URLSearchParams({
    track_name: title || '',
    artist_name: artist || '',
    album_name: album || ''
  });
  if (durationMs) q.set('duration', String(Math.round(durationMs / 1000)));
  let rec = await http('https://lrclib.net/api/get?' + q.toString());
  if (!rec) {
    // Exact lookup missed (edition suffixes, punctuation). Search, then accept only a strict match.
    const sq = new URLSearchParams({ track_name: title || '', artist_name: artist || '' });
    const found = await http('https://lrclib.net/api/search?' + sq.toString());
    rec = pickBest({ title, artist, durationMs }, found);
  }
  if (!rec) return null;
  if (rec.syncedLyrics) return { kind: 'lrc', lrc: rec.syncedLyrics, source: 'lrclib', wordLevel: false };
  if (rec.plainLyrics) return { kind: 'plain', plain: rec.plainLyrics, source: 'lrclib', wordLevel: false };
  return null;
}

module.exports = { fetchLyrics, pickBest, norm };
