import http from 'node:http';
import { URL } from 'node:url';
import { Innertube, UniversalCache } from 'youtubei.js';

const port = Number(process.env.PORT || 10000);
const configuredOrigin = process.env.WEB_ORIGIN || 'https://ds-ann.github.io';

let ytPromise;
async function getYouTube() {
  if (!ytPromise) {
    ytPromise = Innertube.create({
      lang: process.env.YTM_HL || 'en',
      location: process.env.YTM_GL || 'IN',
      cache: new UniversalCache(false),
      retrieve_player: true,
    });
  }
  return ytPromise;
}

const corsHeaders = (requestOrigin) => {
  const allowedOrigin = requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

const send = (req, res, status, body, contentType = 'application/json; charset=utf-8') => {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    ...corsHeaders(req.headers.origin),
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

function mapResult(item) {
  return {
    id: item.id,
    title: item.title?.text || item.title || 'Unknown title',
    artist: item.author?.name || item.author?.text || item.author || 'Unknown artist',
    thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url,
    durationSeconds: item.duration?.seconds,
  };
}

async function searchMusic(query) {
  const yt = await getYouTube();
  const result = await yt.music.search(query, { type: 'song' });
  return (result?.contents || []).map(mapResult).filter((x) => x.id);
}

async function player(videoId) {
  const yt = await getYouTube();
  const info = await yt.getBasicInfo(videoId, 'YTMUSIC');
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  if (!format) throw new Error('No playable audio format returned');

  const url = format.decipher(yt.session.player);
  if (!url) throw new Error('The selected audio format could not be resolved');

  const thumbnail = info.basic_info?.thumbnail;
  return {
    id: videoId,
    title: info.basic_info?.title || 'Unknown title',
    artist: info.basic_info?.author || 'Unknown artist',
    thumbnail: thumbnail?.[thumbnail.length - 1]?.url,
    durationSeconds: Number(info.basic_info?.duration || 0) || undefined,
    streamUrl: url,
    mimeType: format.mime_type,
    bitrate: format.bitrate,
    playable: true,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req.headers.origin));
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/health') return send(req, res, 200, 'ok', 'text/plain; charset=utf-8');

    if (url.pathname === '/api/auth/me') {
      return send(req, res, 200, {
        authenticated: false,
        message: 'Interactive account login is not enabled yet.',
      });
    }

    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query || query.length > 200) return send(req, res, 400, { error: 'invalid_query' });
      return send(req, res, 200, { items: await searchMusic(query) });
    }

    if (url.pathname.startsWith('/api/player/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/player/'.length));
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return send(req, res, 400, { error: 'invalid_video_id' });
      return send(req, res, 200, await player(id));
    }

    return send(req, res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return send(req, res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Metrolist web API listening on 0.0.0.0:${port}`);
});
