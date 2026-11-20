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
  // /api/health answers ok without touching app state
  r = await get('/api/health');
  assert.strictEqual(r.status, 200);
  const h = JSON.parse(r.body);
  assert.strictEqual(h.ok, true);
  assert.ok(Number.isFinite(h.uptimeMs) && h.uptimeMs >= 0);
  assert.ok(Number.isSafeInteger(h.clients));
  // and it is behind the same Host guard as the rest
  assert.strictEqual((await get('/api/health', { Host: 'evil.example' })).status, 403);
  assert.strictEqual((await get('/overlay.css')).status, 200);
  assert.strictEqual((await get('/nope')).status, 404);
  assert.strictEqual((await get('/api/state', { Host: 'evil.example' })).status, 403, 'rebinding host');
  assert.strictEqual((await get('/api/state', { Origin: 'http://evil.example' })).status, 403, 'foreign origin');
  assert.strictEqual((await get('/api/state', { Origin: 'null' })).status, 403, 'null origin');
  assert.strictEqual((await get('/api/state', { 'Sec-Fetch-Site': 'cross-site' })).status, 403, 'cross-site fetch');
  assert.strictEqual((await get('/api/state', {}, 'POST')).status, 403, 'read-only');
  assert.strictEqual((await get('/../package.json')).status, 404, 'no path traversal');
  assert.strictEqual(r.headers['access-control-allow-origin'], undefined);
  // Export endpoints share the Host/Origin guard and do not pretend plain lyrics are timed.
  assert.strictEqual((await get('/api/lyrics.lrc')).status,409);
  web.stop();
  await web.start({getState:()=>({lyrics:{lines:[{startMs:1000,endMs:2500,text:'hello & world'}]}}),log:()=>{}});
  assert.strictEqual((await get('/api/lyrics.lrc')).body,'[00:01.000]hello & world');
  assert.ok((await get('/api/lyrics.srt')).body.includes('00:00:01,000 --> 00:00:02,500'));
  const vtt=await get('/api/lyrics.vtt');
  assert.strictEqual(vtt.headers['content-type'],'text/vtt; charset=utf-8');
  assert.ok(vtt.body.startsWith('WEBVTT\n\n'));
  assert.strictEqual((await get('/api/lyrics.vtt',{Origin:'http://evil.example'})).status,403);
  assert.strictEqual((await get('/api/lyrics.srt',{},'POST')).status,403);
  // SSE: /api/events clients receive broadcast messages
  const sse = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 17971, path: '/api/events', headers: { Host: '127.0.0.1:17971' } }, res => {
      let b = '';
      res.on('data', c => { b += c; if (b.includes('event: ping')) { res.destroy(); resolve(b); } });
    });
    req.on('error', reject);
    req.end();
    setTimeout(() => web.broadcast('ping', { n: 1 }), 100);
  });
  assert.ok(sse.includes('data: {"n":1}'), 'broadcast payload');
  // SSE stream carries the same hardening headers as the other responses
  const sseHeaders = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 17971, path: '/api/events', headers: { Host: '127.0.0.1:17971' } }, res => {
      const h = res.headers; res.destroy(); resolve(h);
    });
    req.on('error', reject); req.end();
  });
  assert.strictEqual(sseHeaders['x-content-type-options'], 'nosniff');
  assert.strictEqual(sseHeaders['cross-origin-resource-policy'], 'same-origin');
  // A failed snapshot is an HTTP error, not an uncaught process exception.
  web.stop();
  await web.start({getState:()=>{throw Error('sensitive internal detail')},log:()=>{}});
  r=await get('/api/state');
  assert.strictEqual(r.status,500);
  assert.strictEqual(JSON.parse(r.body).error,'state unavailable');
  assert.ok(!r.body.includes('sensitive internal detail'));
  assert.strictEqual((await get('/overlay.css')).status,200);
  web.stop();
  console.log('WEBSERVER TESTS PASS');
})().catch(e => { console.error(e); process.exit(1); });

// invalid VERSO_WEB_PORT falls back to 17653 instead of breaking listen()
{
  const { execFileSync } = require('child_process');
  for (const [env, want] of [['abc', '17653'], ['0', '17653'], ['99999', '17653'], ['17654', '17654']]) {
    const out = execFileSync(process.execPath, ['-e',
      `process.env.VERSO_WEB_PORT=${JSON.stringify(env)};process.stdout.write(String(require('./src/webserver.js').PORT))`],
      { cwd: __dirname + '/..' }).toString();
    assert.strictEqual(out, want, `VERSO_WEB_PORT=${env}`);
  }
  console.log('PORT FALLBACK TESTS PASS');
}

// Trailing junk, fractions and whitespace must not silently select another port.
{
 const {execFileSync}=require('child_process');
 for(const value of ['17971junk','17971.5',' 17971','1e4','0x40']) {
  const out=execFileSync(process.execPath,['-e',"process.stdout.write(String(require('./src/webserver').PORT))"],
   {cwd:__dirname+'/..',env:{...process.env,VERSO_WEB_PORT:value}}).toString();
  assert.strictEqual(out,'17653',value);
 }
}
