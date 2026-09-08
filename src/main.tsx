import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Inject auth token into all /api/* requests automatically
const _origFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.startsWith('/api') && !url.startsWith('/api/auth/')) {
    const token = localStorage.getItem('yuzee_auth') || '';
    if (token) {
      init = { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers as Record<string, string> | undefined) } };
    }
  }
  return _origFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
