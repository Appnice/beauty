// A stand-in for the ntfy topic (ADMIN_NOTIFY_URL) on 127.0.0.1:8159. POST stores the body;
// GET /received lists them; DELETE /received clears. Nothing leaves the Mac.
import { createServer } from 'node:http';

const got: { path: string; body: string; at: string }[] = [];
createServer((req, res) => {
  if (req.url === '/received' && req.method === 'GET') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(got));
  }
  if (req.url === '/received' && req.method === 'DELETE') {
    got.length = 0;
    return res.end('ok');
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      got.push({ path: req.url ?? '', body, at: new Date().toISOString() });
      res.end('ok');
    });
    return;
  }
  res.statusCode = 404;
  res.end();
}).listen(8159, '127.0.0.1');
