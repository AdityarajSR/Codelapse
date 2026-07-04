import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
