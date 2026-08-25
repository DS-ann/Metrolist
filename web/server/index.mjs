import http from 'node:http';
import { URL } from 'node:url';
import { Innertube, UniversalCache } from 'youtubei.js';

const port = Number(process.env.PORT || 10000);
const origin = process.env.WEB_ORIGIN || '*';

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

const send = (res, status, body, contentType = 'application/json; charset=utf-8') => {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
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
  const info = await yt.getInfo(videoId);
  const streaming = info.streaming_data;
  if (!streaming) throw new Error('No streaming data returned');

  const formats = [
    ...(streaming.adaptive_formats || []),
    ...(streaming.formats || []),
  ];
  const audio = formats
    .filter((f) => f.mime_type?.startsWith('audio/') && (f.url || f.signature_cipher))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  if (!audio) throw new Error('No playable audio format returned');

  // YouTube.js resolves deciphered URLs when the player response requires it.
  const url = audio.url;
  if (!url) throw new Error('The selected format has no resolved URL');

  return {
    id: videoId,
    title: info.basic_info?.title || 'Unknown title',
    artist: info.basic_info?.author || 'Unknown artist',
    thumbnail: info.basic_info?.thumbnail?.[info.basic_info.thumbnail.length - 1]?.url,
    durationSeconds: Number(info.basic_info?.duration || 0) || undefined,
    streamUrl: url,
    mimeType: audio.mime_type,
    bitrate: audio.bitrate,
    playable: true,
  };
}

const server = http.createServer(async (req, res) => {
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

  try {
    if (url.pathname === '/health') return send(res, 200, 'ok', 'text/plain; charset=utf-8');

    if (url.pathname === '/api/auth/me') {
      return send(res, 200, {
        authenticated: false,
        message: 'Interactive Google/YouTube login is not enabled yet. No credentials are collected by this server.',
      });
    }

    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query) return send(res, 400, { error: 'missing_query' });
      return send(res, 200, { items: await searchMusic(query) });
    }

    if (url.pathname.startsWith('/api/player/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/player/'.length));
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return send(res, 400, { error: 'invalid_video_id' });
      return send(res, 200, await player(id));
    }

    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return send(res, 502, {
      error: 'upstream_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Metrolist web API listening on 0.0.0.0:${port}`);
});
