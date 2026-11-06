// Local browser page: loopback-only, read-only, DNS-rebinding and cross-site reads rejected.
process.env.VERSO_WEB_PORT = '17971';
const assert = require('assert');
const http = require('http');
const web = require('../src/webserver');

function get(path, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 17971, path, method, headers: { Host: '127.0.0.1:17971', ...headers } }, res => {
      let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    req.on('error', reject); req.end();
  });
}

(async () => {
  const url = await web.start({ getState: () => ({ track: { title: 't' }, playing: true }), log: () => {} });
  assert.strictEqual(url, 'http://127.0.0.1:17971/');
  let r = await get('/');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.includes('web-bridge.js') && r.body.includes('<title>Verso</title>'));
  assert.strictEqual(r.headers['cache-control'], 'no-store');
  r = await get('/api/state');
  assert.strictEqual(JSON.parse(r.body).track.title, 't');
  assert.strictEqual((await get('/overlay.css')).status, 200);
  assert.strictEqual((await get('/nope')).status, 404);
  assert.strictEqual((await get('/api/state', { Host: 'evil.example' })).status, 403, 'rebinding host');
  assert.strictEqual((await get('/api/state', { Origin: 'http://evil.example' })).status, 403, 'foreign origin');
  assert.strictEqual((await get('/api/state', { Origin: 'null' })).status, 403, 'null origin');
  assert.strictEqual((await get('/api/state', { 'Sec-Fetch-Site': 'cross-site' })).status, 403, 'cross-site fetch');
  assert.strictEqual((await get('/api/state', {}, 'POST')).status, 403, 'read-only');
  assert.strictEqual((await get('/../package.json')).status, 404, 'no path traversal');
  assert.strictEqual(r.headers['access-control-allow-origin'], undefined);
  web.stop();
  console.log('WEBSERVER TESTS PASS');
})().catch(e => { console.error(e); process.exit(1); });
