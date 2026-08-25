import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 8787);
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  if (url.pathname === '/api/auth/me') {
    return send(res, 200, { authenticated: false });
  }

  if (url.pathname === '/api/search') {
    return send(res, 501, {
      error: 'not_implemented',
      message: 'InnerTube web adapter is the next server layer.',
      query: url.searchParams.get('q') || '',
    });
  }

  if (url.pathname.startsWith('/api/player/')) {
    return send(res, 501, {
      error: 'not_implemented',
      message: 'Stream resolution must be supplied by the InnerTube adapter.',
      id: decodeURIComponent(url.pathname.slice('/api/player/'.length)),
    });
  }

  return send(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.log(`Metrolist web API listening on http://localhost:${port}`);
});
