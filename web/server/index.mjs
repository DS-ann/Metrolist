import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 8787);
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const apiUrl = 'https://music.youtube.com/youtubei/v1';

const client = {
  clientName: 'WEB_REMIX',
  clientVersion: process.env.YTM_CLIENT_VERSION || '1.20260818.01.00',
  hl: process.env.YTM_HL || 'en',
  gl: process.env.YTM_GL || 'IN',
};

function context() {
  return { client };
}

async function innerTube(endpoint, body) {
  const response = await fetch(`${apiUrl}/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://music.youtube.com',
      'referer': 'https://music.youtube.com/',
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`InnerTube ${response.status}`);
  return response.json();
}

const text = (runs) => runs?.map((run) => run.text || '').join('') || '';

function thumbnail(renderer) {
  return renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url
    || renderer?.thumbnail?.thumbnails?.at(-1)?.url;
}

function parseSearch(data) {
  const items = [];
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
  for (const tab of tabs) {
    const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    for (const section of sections) {
      const contents = section?.musicShelfRenderer?.contents || section?.itemSectionRenderer?.contents || [];
      for (const entry of contents) {
        const r = entry?.musicResponsiveListItemRenderer;
        if (!r) continue;
        const id = r?.playlistItemData?.videoId || r?.navigationEndpoint?.watchEndpoint?.videoId;
        if (!id) continue;
        const flex = r?.flexColumns || [];
        const title = text(flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs) || 'Unknown title';
        const subtitleRuns = flex.slice(1).flatMap((x) => x?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
        const subtitle = text(subtitleRuns);
        items.push({
          id,
          title,
          artist: subtitle.split(' • ')[0] || 'Unknown artist',
          thumbnail: thumbnail(r),
        });
      }
    }
  }
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function parsePlayer(data, id) {
  const details = data?.videoDetails;
  const formats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];
  const audio = formats
    .filter((format) => format?.mimeType?.startsWith('audio/') && format?.url)
    .sort((a, b) => (b?.bitrate || 0) - (a?.bitrate || 0))[0];

  return {
    id,
    title: details?.title || 'Unknown title',
    artist: details?.author || 'Unknown artist',
    durationSeconds: Number(details?.lengthSeconds || 0) || undefined,
    thumbnail: details?.thumbnail?.thumbnails?.at(-1)?.url,
    streamUrl: audio?.url,
    streamExpiresAt: audio?.url ? Date.now() + 5 * 60 * 1000 : undefined,
    playable: Boolean(audio?.url),
    reason: audio?.url ? undefined : 'The player response did not expose a direct audio URL. SABR/po-token handling is not implemented in this MVP.',
  };
}

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
};

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
    if (url.pathname === '/api/auth/me') return send(res, 200, { authenticated: false });

    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query) return send(res, 400, { error: 'missing_query' });
      const data = await innerTube('search', { context: context(), query, params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D' });
      return send(res, 200, { items: parseSearch(data) });
    }

    if (url.pathname.startsWith('/api/player/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/player/'.length));
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return send(res, 400, { error: 'invalid_video_id' });
      const data = await innerTube('player', { context: context(), videoId: id, contentCheckOk: true, racyCheckOk: true });
      return send(res, 200, parsePlayer(data, id));
    }

    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return send(res, 502, { error: 'upstream_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

server.listen(port, () => console.log(`Metrolist web API listening on http://localhost:${port}`));
