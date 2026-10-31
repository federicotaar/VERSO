// Apple Music word-by-word provider (REAL word timings).
// Uses the USER'S OWN Apple Music account token (media-user-token) that the
// user pastes in settings - same model open-source apps like LyricsBlossom use.
// Without a token this provider is inactive. Never shares the token anywhere
// except api.music.apple.com / amp-api.music.apple.com.
const https = require('https');

function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// TTML -> unified model with word timings
function parseTtml(ttml) {
  const lines = [];
  const pRe = /<p[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  const spanRe = /<span[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
  const toMs = s => {
    const m = s.match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);
    if (m) return Math.round(((+m[1] || 0) * 3600 + (+m[2]) * 60 + parseFloat(m[3])) * 1000);
    const f = parseFloat(s);
    return isNaN(f) ? null : Math.round(f * 1000);
  };
  const strip = h => h.replace(/<[^>]+>/g, '');
  let m;
  while ((m = pRe.exec(ttml)) !== null) {
    const line = { startMs: toMs(m[1]), endMs: toMs(m[2]), text: '', words: [] };
    let sm;
    while ((sm = spanRe.exec(m[3])) !== null) {
      const w = { text: strip(sm[3]), startMs: toMs(sm[1]), endMs: toMs(sm[2]) };
      line.words.push(w);
    }
    line.text = line.words.length ? line.words.map(w => w.text).join('').replace(/\s+/g, ' ').trim()
                                  : strip(m[3]).trim();
    if (line.text) lines.push(line);
  }
  return { lines: lines.filter(l => l.words.length) };
}

async function fetchWordLyrics({ title, artist }, userToken, devToken, storefront) {
  if (!userToken || !devToken) return null;
  const sf = storefront || 'it';
  const h = { Authorization: 'Bearer ' + devToken, 'Media-User-Token': userToken, Origin: 'https://music.apple.com' };
  const q = new URLSearchParams({ term: (title + ' ' + artist), types: 'songs', limit: '1' });
  const search = await getJson(`https://api.music.apple.com/v1/catalog/${sf}/search?` + q, h);
  const song = search && search.results && search.results.songs && search.results.songs.data[0];
  if (!song) return null;
  const lyr = await getJson(`https://amp-api.music.apple.com/v1/catalog/${sf}/songs/${song.id}/lyrics`, h);
  const ttml = lyr && lyr.data && lyr.data[0] && lyr.data[0].attributes && lyr.data[0].attributes.ttml;
  if (!ttml) return null;
  return { kind: 'ttml', ttml, source: 'apple-music', wordLevel: true };
}

module.exports = { fetchWordLyrics, parseTtml };
