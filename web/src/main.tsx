import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, type Track } from './api';
import './styles.css';

const moods = ['Chill', 'Energy', 'Focus', 'Workout', 'Sleep', 'Party', 'Romance', 'Discover'];

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
      try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler!); } catch { /* unsupported */ }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, null); } catch { /* unsupported */ }
      }
    };
  }, [player, current]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
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

  const homeTracks = results.slice(0, 10);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => { setResults([]); setQuery(''); }}>Metrolist</button>
        <form className="search" onSubmit={search}>
          <span className="search-icon">⌕</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search songs, artists, albums…" />
          <button type="submit">Search</button>
        </form>
        <button className="login" onClick={() => setError('Web login will be handled by the server session layer.')}>Sign in</button>
      </header>

      <main className="home">
        <div className="home-heading">
          <div>
            <span className="overline">WELCOME BACK</span>
            <h1>Home</h1>
          </div>
          <button className="icon-action" aria-label="Random music">⌘</button>
        </div>

        <nav className="chips" aria-label="Home categories">
          {['For you', 'Quick picks', 'Daily discover', 'Mood & genres'].map((chip, i) => (
            <button className={i === 0 ? 'chip active' : 'chip'} key={chip}>{chip}</button>
          ))}
        </nav>

        <section className="speed-dial">
          <div className="section-title"><h2>Speed dial</h2><button>See all</button></div>
          <div className="speed-row">
            {homeTracks.slice(0, 6).map(track => (
              <button className="speed-item" key={track.id} onClick={() => void play(track)}>
                {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <div className="speed-cover" />}
                <span>{track.title}</span>
              </button>
            ))}
            {homeTracks.length === 0 && <div className="empty-home">Search for music to build your Speed dial.</div>}
          </div>
        </section>

        <section>
          <div className="section-title"><h2>Quick picks</h2><button>More</button></div>
          <div className="album-row">
            {homeTracks.slice(0, 8).map(track => (
              <button className="music-card" key={track.id} onClick={() => void play(track)}>
                {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <div className="card-cover" />}
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </button>
            ))}
            {homeTracks.length === 0 && <div className="empty-home">Your personalized picks will appear here.</div>}
          </div>
        </section>

        <section className="discover-panel">
          <div>
            <span className="overline">DISCOVER SOMETHING NEW</span>
            <h2>Daily discover</h2>
            <p>Fresh music based on what you listen to.</p>
          </div>
          <button onClick={() => { setQuery('new music'); void search({ preventDefault() {} } as FormEvent); }}>Explore</button>
        </section>

        <section>
          <div className="section-title"><h2>Mood & genres</h2><button>See all</button></div>
          <div className="mood-grid">
            {moods.map((mood, i) => <button key={mood} className={`mood mood-${i % 4}`} onClick={() => { setQuery(mood); }}>{mood}</button>)}
          </div>
        </section>

        <section>
          <div className="section-title"><h2>Keep listening</h2><button>History</button></div>
          <div className="keep-listening">{current ? <button className="keep-item" onClick={() => void play(current)}><img src={current.thumbnail} alt="" /><span><strong>{current.title}</strong><small>{current.artist}</small></span><b>▶</b></button> : <div className="empty-home">Your listening history will appear here.</div>}</div>
        </section>

        {error && <div className="error">{error}</div>}
        {loading && <div className="muted loading">Searching…</div>}
        {!loading && results.length > 0 && (
          <section className="search-results">
            <div className="section-title"><h2>Search results</h2></div>
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
