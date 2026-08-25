import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 10000);
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';

const send = (res, status, body, extra = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }

  if (url.pathname === '/api/auth/me') return send(res, 200, { authenticated: false });

  return send(res, 404, { error: 'not_found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Metrolist web API listening on 0.0.0.0:${port}`);
});
