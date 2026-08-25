import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, type Track } from './api';
import './styles.css';

function App() {
  const audio = useRef(new Audio()).current;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audio]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album ?? 'Metrolist',
      artwork: current.thumbnail ? [{ src: current.thumbnail }] : [],
    });
    const controls: [MediaSessionAction, () => void][] = [
      ['play', () => void audio.play()],
      ['pause', () => audio.pause()],
    ];
    for (const [action, handler] of controls) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    }
  }, [audio, current]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError('');
    try { setResults((await api.search(query.trim())).items); }
    catch { setError('The web API is not connected yet.'); }
    finally { setLoading(false); }
  }

  async function play(track: Track) {
    setError('');
    try {
      const resolved = track.streamUrl ? track : await api.player(track.id);
      if (!resolved.streamUrl) throw new Error('No stream URL');
      audio.src = resolved.streamUrl;
      audio.load();
      await audio.play();
      setCurrent(resolved);
    } catch {
      setError('Playback is unavailable until the server stream adapter is configured.');
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
        <button className="play-button" onClick={() => playing ? audio.pause() : void audio.play()} disabled={!current}>{playing ? '❚❚' : '▶'}</button>
        <div className="player-status">{playing ? 'Playing' : current ? 'Paused' : 'Ready'}</div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
