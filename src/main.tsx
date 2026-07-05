import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted variable fonts — bundled by Vite, no external font CDN, so the
// edge-hosted app stays fully self-contained.
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/space-grotesk/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

const Fatal = (
  <div className="fatal" role="alert">
    <p>Something went wrong.</p>
    <button className="btn btn--run" onClick={() => location.reload()}>
      Reload
    </button>
  </div>
);

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary fallback={Fatal}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
