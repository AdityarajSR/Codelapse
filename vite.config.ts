import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Codelapse — browser-tier build.
// The Python tracer runs in an ES-module Web Worker so it can dynamically
// import the pinned Pyodide runtime. See src/worker/pyodide.worker.ts.
// Test config lives in vitest.config.ts.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
