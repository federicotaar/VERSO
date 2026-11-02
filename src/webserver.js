// Local browser page for Verso. Serves the same lyric renderer over http on 127.0.0.1 only.
// Read-only: no write endpoints. Not reachable from other devices (loopback bind).
// DNS-rebinding and cross-site reads are blocked: Host and Origin must be this server, and no CORS headers are sent.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.VERSO_WEB_PORT || '17653', 10);
const RENDERER = path.join(__dirname, 'renderer');
const FILES = {
  '/overlay.css': 'text/css; charset=utf-8',
  '/overlay.js': 'text/javascript; charset=utf-8',
  '/icons.js': 'text/javascript; charset=utf-8',
  '/fonts.css': 'text/css; charset=utf-8',
  '/web-bridge.js': 'text/javascript; charset=utf-8'
};
const clients = new Set();
let server = null, getState = () => ({}), log = () => {}, started = null;

function hostOk(h) {
  return typeof h === 'string' && [`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`].includes(h.toLowerCase());
}
function originOk(req) {
  const o = req.headers.origin;
  if (o && o !== 'null' && !(o.startsWith('http://') && hostOk(o.slice(7)))) return false;
  if (o === 'null') return false;
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
}
function indexHtml() {
  let h = fs.readFileSync(path.join(RENDERER, 'overlay.html'), 'utf8');
  h = h.replace('<script src="overlay.js"></script>', '<script src="web-bridge.js"></script>\n<script src="overlay.js"></script>');
  h = h.replace('<head>', '<head>\n<title>Verso</title>');
  return h;
}
function handle(req, res) {
  const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }); res.end(body); };
  if (req.method !== 'GET' || !hostOk(req.headers.host) || !originOk(req)) return send(403, 'text/plain', 'forbidden');
  const p = (req.url || '/').split('?')[0];
  if (p === '/' || p === '/index.html') return send(200, 'text/html; charset=utf-8', indexHtml());
  if (FILES[p]) {
    let body = fs.readFileSync(path.join(RENDERER, p.slice(1)));
    if (p === '/icons.js') body = 'var module = { exports: {} };\n' + body; // the file also targets CommonJS
    return send(200, FILES[p], body);
  }
  if (p === '/api/state') return send(200, 'application/json', JSON.stringify(getState()));
  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 1500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  send(404, 'text/plain', 'not found');
}
function start(opts) {
  if (server) return Promise.resolve(url());
  getState = opts.getState; log = opts.log || log;
  return new Promise(resolve => {
    const s = http.createServer(handle);
    s.on('error', e => { log('web server error: ' + e.code); server = null; resolve(null); });
    s.listen(PORT, '127.0.0.1', () => { server = s; started = Date.now(); log('web page on ' + url()); resolve(url()); });
  });
}
function url() { return server ? `http://127.0.0.1:${PORT}/` : null; }
function broadcast(kind, data) {
  if (!clients.size) return;
  const msg = `event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch {} }
}
function stop() { for (const c of clients) { try { c.end(); } catch {} } clients.clear(); if (server) { server.close(); server = null; } }
module.exports = { start, stop, broadcast, url, PORT };
