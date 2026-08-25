# Metrolist Web API

This server is the security boundary between the browser and the YouTube Music/InnerTube implementation.

## Local development

```bash
cd web/server
npm start
```

The initial endpoints intentionally return `501` for InnerTube operations. Do not put YouTube cookies, SAPISID values, or other authentication material in the frontend. The next implementation should add a maintained server-side InnerTube adapter for search, player/stream resolution, account state, playlists, and lyrics.

Environment:

- `PORT` — API port, default `8787`
- `WEB_ORIGIN` — allowed browser origin, default `http://localhost:5173`
