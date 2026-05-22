import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@relay-inspector/ui/App';
import '@relay-inspector/ui/index.css';
import { createRuntimeTransport } from './runtime-transport';

const transport = createRuntimeTransport();

const setupHint = (
  <>
    Make sure the inspected page uses Relay, then reload it so our hook can
    attach before <code>new Environment(...)</code>.
  </>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App transport={transport} setupHint={setupHint} />
  </StrictMode>,
);
