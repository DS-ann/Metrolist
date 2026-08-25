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

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': configuredOrigin,
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const send = (req, res, status, body, contentType = 'application/json; charset=utf-8') => {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    ...corsHeaders(),
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

function textValue(value, fallback = '') {
  if (typeof value === 'string') return value;
  return value?.text || value?.toString?.() || fallback;
}

function mapResult(item) {
  const thumbnails = item.thumbnails || item.thumbnail || [];
  return {
    id: item.id,
    title: textValue(item.title, 'Unknown title'),
    artist: textValue(item.author?.name || item.author, 'Unknown artist'),
    thumbnail: thumbnails[thumbnails.length - 1]?.url,
    durationSeconds: item.duration?.seconds || item.duration?.total_seconds,
  };
}

async function searchMusic(query) {
  const yt = await getYouTube();
  const result = await yt.music.search(query, { type: 'song' });
  const contents = result?.songs?.contents || result?.contents || [];
  console.log(`Search "${query}" returned ${contents.length} items`);
  return contents.map(mapResult).filter((x) => x.id);
}

async function player(videoId) {
  const yt = await getYouTube();
  // youtubei.js exposes getStreamingData() specifically for obtaining a
  // deciphered playable format URL. Passing options as an object is required
  // by current youtubei.js versions.
  const format = await yt.getStreamingData(videoId, {
    type: 'audio',
    quality: 'best',
  });

  if (!format?.url) throw new Error('No playable audio format returned');

  return {
    id: videoId,
    title: format.video_details?.title || 'Unknown title',
    artist: format.video_details?.author || 'Unknown artist',
    streamUrl: format.url,
    mimeType: format.mime_type,
    bitrate: format.bitrate,
    playable: true,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  console.log(`${req.method} ${url.pathname}${url.search}`);

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
    console.error('API error:', error);
    return send(req, res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Metrolist web API listening on 0.0.0.0:${port}`);
});
