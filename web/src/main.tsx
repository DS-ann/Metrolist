import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, type Track } from './api';
import './styles.css';

function App() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!audio.current) audio.current = new Audio();
  const player = audio.current;

  useEffect(() => {
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    return () => {
      player.pause();
      player.removeAttribute('src');
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [player]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album ?? 'Metrolist',
      artwork: current.thumbnail ? [{ src: current.thumbnail }] : [],
    });

    const handlers: Partial<Record<MediaSessionAction, () => void>> = {
      play: () => void player.play(),
      pause: () => player.pause(),
      stop: () => { player.pause(); player.currentTime = 0; },
      seekbackward: () => { player.currentTime = Math.max(0, player.currentTime - 10); },
      seekforward: () => { player.currentTime = Math.min(Number.isFinite(player.duration) ? player.duration : Infinity, player.currentTime + 10); },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler!); } catch { /* unsupported action */ }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, null); } catch { /* unsupported action */ }
      }
    };
  }, [player, current]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError('');
    try { setResults((await api.search(query.trim())).items); }
    catch (e) { setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { setLoading(false); }
  }

  async function play(track: Track) {
    setError('');
    try {
      const resolved = track.streamUrl ? track : await api.player(track.id);
      if (!resolved.streamUrl) throw new Error('No playable stream was returned.');
      player.pause();
      player.src = resolved.streamUrl;
      player.load();
      setCurrent(resolved);
      await player.play();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } catch (e) {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      setError(e instanceof Error ? e.message : 'Playback failed.');
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Metrolist</div>
        <form className="search" onSubmit={search}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search songs, artists, albums…" />
          <button type="submit">Search</button>
        </form>
        <button className="login" onClick={() => setError('Web login will be handled by the server session layer.')}>Sign in</button>
      </header>

      <main className="content">
        <section className="hero-card">
          <div>
            <span className="eyebrow">METROLIST WEB</span>
            <h1>Music without the Android shell.</h1>
            <p>Search, stream and control playback from an installable web app.</p>
          </div>
          <div className="hero-note">Background playback<br />Media Session ready</div>
        </section>

        {error && <div className="error">{error}</div>}
        {loading && <div className="muted">Searching…</div>}
        {!loading && results.length > 0 && (
          <section>
            <h2>Results</h2>
            <div className="results">{results.map(track => (
              <button className="track" key={track.id} onClick={() => void play(track)}>
                {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <div className="cover" />}
                <span><strong>{track.title}</strong><small>{track.artist}{track.album ? ` · ${track.album}` : ''}</small></span>
                <span className="play">▶</span>
              </button>
            ))}</div>
          </section>
        )}
      </main>

      <footer className="player">
        <div className="now-playing">
          {current ? <><strong>{current.title}</strong><span>{current.artist}</span></> : <span>Nothing playing</span>}
        </div>
        <button className="play-button" onClick={() => playing ? player.pause() : void player.play()} disabled={!current}>{playing ? '❚❚' : '▶'}</button>
        <div className="player-status">{playing ? 'Playing' : current ? 'Paused' : 'Ready'}</div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
