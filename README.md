<div align="center">

<img src="docs/hero.svg" alt="Codelapse — watch your code run" width="100%" />

<br/>

**Paste code, press <kbd>▶</kbd>, and watch every line execute** — with live variables, printed
output, a control‑flow graph, and a **3D stage** where arrays, stacks and dicts move as physical objects.

<br/>

[![License](https://img.shields.io/badge/License-Apache_2.0-8a7cff?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-33d6f5?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
[![Vite](https://img.shields.io/badge/Vite-6-8a7cff?style=flat-square&logo=vite&logoColor=white)](vite.config.ts)
[![100% client-side](https://img.shields.io/badge/100%25-client--side-3adfa5?style=flat-square)](#-how-it-works)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-33d6f5?style=flat-square)](#-contributing)

### [▶ Try it live — codelapse.vercel.app](https://codelapse.vercel.app)

[Architecture](docs/PLAN.md) &nbsp;·&nbsp; [Roadmap](#-roadmap) &nbsp;·&nbsp; [Quick start](#-quick-start)

</div>

---

## ✨ What it is

Codelapse is a **visual dry run** of code for students and self‑taught developers. Instead of
guessing what your program does, you *watch* it happen:

- the current **line** highlights as it runs
- **variables** update, flashing `old → new` when they change
- **output** builds up as it prints
- the **control‑flow** lights the active branch
- a **3D WebGL stage** animates your data structures — an element flies into an array, a key drops into a dict, boxes pulse when a value changes

…and it plays back like a video: step forward/back, scrub the timeline, pick a speed. Your code
**runs entirely in your browser**. It is only sent to a server when you ask the optional **AI
assistant** a question.

> 📸 _Drop a screenshot of the playground here — run `npm run dev` and capture it._

---

## 🧩 Features

| | |
|---|---|
| 🎬 **Video‑style playback** | Play / pause, step, scrub, speed (1×–16×), jump to the next variable change |
| 🧊 **3D data‑structure stage** | Arrays, dicts, sets and strings as physical objects (Three.js) — with a 2D fallback |
| 🐍 **Python** + 🟨 **JavaScript** | Both traced **in the browser** (Pyodide / AST‑instrumentation) — Java, C, C++ are on the roadmap |
| 🧑‍🏫 **AI assistant** | Plain‑language explanation of every step (instant, no AI), AI Q&A (free Gemini by default) — explain the code, line by line, find bugs, time/space complexity, practice questions — and prediction quizzes checked against the real run |
| 🎨 **Bold, alive UI** | Dark glass, gradient accents, brand syntax highlighting |
| ♿ **Accessible** | Keyboard‑driven, focus rings, reduced‑motion aware, screen‑reader output |
| 🔒 **Safe by design** | User code runs in a **network‑stripped Web Worker** — no `fetch` |

---

## ⚡ How it works

One idea powers everything: **run the code once, record a trace, then just *walk* the trace.**

```
Editor ──Run──▶ Web Worker (tracer) ──▶ steps[]  ──▶  Playback clock
                                          │                 │
                 a per-step snapshot of   │      ┌──────────┼───────────┬────────────┐
                 line · vars · stack ·    │      ▼          ▼           ▼            ▼
                 stdout, all precomputed  │   editor    variables    output     3D stage
```

Because playback is just indexing into a precomputed array, **stepping backward is free** and
the timeline scrubs instantly. Every language emits the *same* trace shape, so the whole player is
language‑agnostic.

**Two tiers, one UI:** Python & JS/TS trace **in the browser** (free, safe, zero backend). Compiled
languages (Go, Java, C/C++) are a later **server tier** — they have no in‑browser tracer, so they run
in a hardened sandbox. See [docs/PLAN.md](docs/PLAN.md).

---

## 🚀 Quick start

```bash
git clone git@github.com:RskOO7/Codelapse.git
cd Codelapse
npm install
npm run dev          # → http://localhost:5173
```

The Python engine (Pyodide) streams from a pinned CDN on first run and is cached after.

**AI assistant (optional)**

The assistant panel under the editor has three tabs:

| Tab | What it does | Needs an API key? |
|---|---|---|
| **This step** | Explains the current step: the line about to run, which variables changed and why, loop jumps, true/false conditions, the call stack, output, and errors with a suggested fix | No — computed from the trace |
| **Ask AI** | Chat with an AI (Gemini by default) about your code, plus one‑click *What does this code do?*, *Explain line by line*, *Explain this step*, *Find bugs*, *Time & space complexity*, *Quiz & practice questions* | Yes |
| **Quiz** | "After line 5 runs, what will `total` be?" / "Which line runs next?" — answers come from the real run, with *Show me* to jump there | No |
| **Lisa** (top bar, <kbd>Ctrl</kbd>+<kbd>K</kbd>) | Type or speak: "write a binary search" → code in the editor, run, and explained; questions go to the chat; "next step", "play", "run it", "go back" | Only for writing code / questions |

🎤 Mic buttons (Lisa and the chat) use the browser's speech recognition (Chrome, Edge, Safari).
🔊 Speaker buttons read answers and step explanations aloud with a female voice, on the device.

To turn on **Ask AI** for free, get a Gemini API key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit card) and put it in
`.env.local`:

```bash
cp .env.example .env.local   # then edit: GEMINI_API_KEY=AIza...
npm run dev                  # restart after changing .env.local
```

The key stays on the server (`server/assistant.ts`, served at `/api/assistant`) and is never
sent to the browser. Questions go to `gemini-3.8-flash` by default (`GEMINI_MODEL` to change it).
Groq (`GROQ_API_KEY`, also free) and Claude (`ANTHROPIC_API_KEY`, paid) are supported too — see
[`.env.example`](.env.example). Each client is limited to 30 questions per 10 minutes.

> **Free‑tier notes:** Google's free tier has per‑minute and per‑day limits shared by everyone using
> your deployment, and Google may use free‑tier prompts to improve its products. Check the current
> terms and limits in AI Studio.

**Scripts**

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type‑check + production build → `dist/` |
| `npm run test` | Vitest suite |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## ⌨️ Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| <kbd>Space</kbd> | Play / pause | <kbd>←</kbd> <kbd>→</kbd> | Step back / forward |
| <kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> | Jump to prev/next change | <kbd>Home</kbd> <kbd>End</kbd> | First / last step |
| <kbd>,</kbd> <kbd>.</kbd> | Slower / faster | <kbd>Esc</kbd> | Close dialog |

*(Active only when the editor isn't focused.)*

---

## 🛠️ Tech stack

**Vite** · **React** · **TypeScript** (strict) · **CodeMirror 6** · **Pyodide** (Python→WASM) ·
**Three.js / react‑three‑fiber** · **Zustand** · **acorn** (JS tracer) · **lz‑string** ·
**Google Gen AI SDK** / Groq / Anthropic SDKs (AI assistant).

A static site plus one serverless function (`api/assistant.ts`) for the AI assistant. No database.

---

## ☁️ Deploy (Vercel)

The browser tier is a static site — it deploys to Vercel with **zero config**
([`vercel.json`](vercel.json) pins the Vite preset, `dist` output, and asset caching):

1. **Import** this repo at [vercel.com/new](https://vercel.com/new) → Deploy. That's it.
2. Or via CLI: `npm i -g vercel && vercel --prod`.

Every push to `main` auto‑deploys. For the AI assistant, add `GEMINI_API_KEY` under
**Project → Settings → Environment Variables**; Vercel serves [`api/assistant.ts`](api/assistant.ts)
as a serverless function. Without the key the rest of the app works normally and **Ask AI** shows a
setup message.

---

## 🗺 Roadmap

- [x] Python tracer + full playback UI
- [x] 3D WebGL data‑structure stage
- [x] JavaScript tracer (in‑browser)
- [x] Design system, custom UI
- [x] AI assistant — step explanations, AI Q&A, quizzes
- [ ] TypeScript, more seed examples (placement‑prep set)
- [ ] Cinema mode · command palette · scrubber tooltips
- [ ] **Server tier** — Go, Java, C/C++ in a sandbox (demand‑gated)

---

## 🤝 Contributing

Issues and PRs are welcome. `npm run build && npm test && npm run lint` should pass; CI runs
type‑check, lint, format, tests and build on every push
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

---

## 📄 License

[Apache‑2.0](LICENSE) — see [NOTICE](NOTICE) for third‑party licenses (Pyodide, CodeMirror, Three.js, …).

<div align="center"><sub>Built with ▶ and a lot of <code>console.log</code>.</sub></div>
