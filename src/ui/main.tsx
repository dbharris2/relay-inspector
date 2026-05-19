import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createWebSocketTransport } from './transport';
import './index.css';

/**
 * Pick the inspector server's WS URL based on where this page is being
 * served from. In Vite dev mode (`pnpm dev`) the UI runs on :5173 and
 * must point at the standalone server on :8097; in production
 * (`pnpm dev:server` after `pnpm build`) the UI is served by the server
 * itself, so we reuse the page origin.
 */
function getWebSocketUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8097/ws';
  const { hostname, port, protocol } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173' || port === '') {
    return `ws://${hostname || 'localhost'}:8097/ws`;
  }
  return `${wsProto}//${hostname}:${port}/ws`;
}

const transport = createWebSocketTransport(getWebSocketUrl());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
