import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleAssistant, type AssistantEnv } from './server/assistant';

/**
 * Serves POST /api/assistant during `vite dev` / `vite preview` with the same
 * handler the deployed Vercel function uses (api/assistant.ts). The API key is
 * read from .env.local and never reaches the browser bundle (no VITE_ prefix).
 */
function assistantApi(env: AssistantEnv): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse) => {
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const request = new Request(`http://localhost${req.url ?? '/'}`, {
        method: req.method,
        headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
        body: req.method === 'POST' ? Buffer.concat(chunks).toString('utf8') : undefined,
        signal: controller.signal,
      });
      const response = await handleAssistant(request, env, req.socket.remoteAddress ?? 'local');
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('[assistant]', err);
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      }
    }
  };
  return {
    name: 'codelapse-assistant-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant', (req, res) => void middleware(req, res));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/assistant', (req, res) => void middleware(req, res));
    },
  };
}

// Codelapse — browser-tier build.
// The Python tracer runs in an ES-module Web Worker so it can dynamically
// import the pinned Pyodide runtime. See src/worker/pyodide.worker.ts.
// Test config lives in vitest.config.ts.
export default defineConfig(({ mode }) => {
  // '' prefix: load every variable from .env files, not just VITE_* ones —
  // these stay in the Node process and are never injected into client code.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), assistantApi(env)],
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
  };
});
