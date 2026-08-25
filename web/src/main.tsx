import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">METROLIST WEB</p>
        <h1>Your music, on the web.</h1>
        <p className="subtitle">
          The web port is being built inside the existing Metrolist repository.
        </p>
        <div className="status-card">
          <strong>Web foundation ready</strong>
          <span>Search, authentication and browser playback are the next layers.</span>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
