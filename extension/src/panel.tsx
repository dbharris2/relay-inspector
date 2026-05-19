import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '~/ui/App';
import '~/ui/index.css';
import { createRuntimeTransport } from './runtime-transport';

const transport = createRuntimeTransport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
