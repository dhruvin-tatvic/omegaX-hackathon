import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppContent } from './App';

export function render(url) {
  const html = renderToString(
    <React.StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <AppContent />
      </MemoryRouter>
    </React.StrictMode>
  );
  return { html };
}
