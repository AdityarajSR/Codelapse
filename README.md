# Codelapse

Paste code, press play, and watch every line execute — with live variables, printed
output, a control-flow graph, and a **3D data-structure stage** where arrays, stacks,
dicts, slices and recursion animate as physical objects.

A visual "dry run" of code for students and self-taught developers. **Multi-language**
(Python, JS/TS in the browser; **Go** and other compiled languages on a sandboxed server),
all driven by one playback UI.

## Status
Planning → build. **Codelapse** (name locked). **v1 = browser-only, edge-hosted** (Vercel) — Python + JS/TS
run in the browser, no server needed. The self-hosted **home server is deferred** to the Go/compiled server tier,
built only on proven demand. No AI. No signup/DB. Monetization deferred.

## Docs
- [docs/PLAN.md](docs/PLAN.md) — architecture, the two-tier execution model, modules, and build order (the living plan)
- [docs/REVENUE.md](docs/REVENUE.md) — how it stays free forever (deferred until there's traffic)

## Core idea in one line
**Two-tier, one playback UI.** Browser tier: Python/JS/TS execute in-browser via WASM — free, safe, ~$0.
Server tier: Go and other compiled languages run in a **hardened gVisor sandbox** on the home box (they have
no in-browser tracer). Both emit the **same trace array**, so the player, panels and 3D stage are unchanged.
Short links + offline hash fallback for sharing; 3D via WebGL (Three.js), device-gated.

## Getting started (development)

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (http://localhost:5173)
```

The Python engine (Pyodide) is loaded on first run from a pinned CDN path and cached; the
tracer runs in a **network-stripped Web Worker** (`fetch`/`XHR`/`WebSocket` removed after load),
so user code — including code opened from a shared link — cannot reach the network.

**Scripts:** `npm run build` (type-check + production build) · `npm run typecheck` · `npm run lint`
· `npm run format` · `npm test` (Vitest).

**Stack:** Vite + React + TypeScript · CodeMirror 6 · Pyodide (Python→WASM) · Zustand. See
[docs/PLAN.md](docs/PLAN.md) for the architecture and the v1 scope, and
[NOTICE](NOTICE) for third-party licenses.

## Tests

`npm test` runs the Vitest suite (the trace-model pure functions today; the tracer fixture
suite in PLAN.md §9.4 is next). CI (`.github/workflows/ci.yml`) runs type-check, lint,
format-check, tests, and build on every push and PR.

## Deploy (Vercel)

The browser tier is a fully static site — no server. It deploys to Vercel with zero manual
config; [vercel.json](vercel.json) pins the Vite framework preset, `npm run build`, the `dist`
output, and long-cache headers for hashed assets.

- **Import** the GitHub repo in Vercel → it auto-detects the settings above → Deploy.
- Or via CLI: `npm i -g vercel && vercel` (preview) / `vercel --prod` (production).

Everything runs in the visitor's browser, so there are no environment variables, no secrets,
and no serverless functions. Pyodide streams from a pinned jsDelivr path at runtime (preconnected
in `index.html`). The Go/compiled server tier is a separate, later deployment (see docs/PLAN.md).
