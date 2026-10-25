// HTTPS in front of a local craft server, for trying the macro without a
// real internal server. Forge only approves https:// domains.
//
//   node dev/tls-proxy.mjs <cert.pem> <key.pem> [listenPort] [targetUrl]
//
// Defaults: listen on 8443, forward to http://localhost:8080. Make the
// certificate with mkcert for craft.localtest.me (which resolves to
// 127.0.0.1); see docs/local-development.md.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { request } from 'node:http';

const [cert, key, port = '8443', target = 'http://localhost:8080'] = process.argv.slice(2);
if (!cert || !key) {
  console.error('usage: node dev/tls-proxy.mjs <cert.pem> <key.pem> [listenPort] [targetUrl]');
  process.exit(2);
}
const upstream = new URL(target);

createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
  const out = request({
    hostname: upstream.hostname,
    port: upstream.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, (up) => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  out.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`craft server unreachable at ${target}: ${e.message}\n`);
  });
  req.pipe(out);
}).listen(Number(port), () => console.log(`https://craft.localtest.me:${port} -> ${target}`));
