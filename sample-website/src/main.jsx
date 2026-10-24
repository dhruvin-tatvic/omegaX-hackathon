import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const rootEl = document.getElementById('root');
if (rootEl && rootEl.hasChildNodes()) {
  hydrateRoot(
    rootEl,
    <StrictMode>
      <App />
    </StrictMode>
  );
} else if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
