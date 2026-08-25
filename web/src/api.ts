export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: string;
  durationSeconds?: number;
  streamUrl?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const API_PREFIX = import.meta.env.VITE_API_BASE ? '/api' : '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  search: (query: string) => request<{ items: Track[] }>(`/search?q=${encodeURIComponent(query)}`),
  player: (id: string) => request<Track>(`/player/${encodeURIComponent(id)}`),
  me: () => request<{ authenticated: boolean; name?: string }>('/auth/me'),
};
