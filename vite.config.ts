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
    rollupOptions: {
      output: {
        // Long-cacheable vendor chunks; app-code edits no longer bust them.
        // (three/@react-three already isolate via the lazy Stage3D chunk.)
        manualChunks: {
          react: ['react', 'react-dom'],
          codemirror: [
            '@uiw/react-codemirror',
            '@codemirror/lang-python',
            '@codemirror/view',
            '@codemirror/state',
          ],
        },
      },
    },
  },
});
