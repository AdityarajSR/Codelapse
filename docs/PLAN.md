# Codelapse — Build Plan

A living document. Every module below is an independent, interrogatable unit — we can drill
into any one, swap it, or extend it without touching the others. "Add more things" = add an
extension point or a new module, not a rewrite.

> **2026-07-04 update — three decisions now shape everything below:**
> 1. **Deployment is a self-hosted home server** (an HP laptop: i5 6th/7th gen, 8 GB RAM, 128 GB SSD), **not** Cloudflare Pages.
> 2. **Multi-language dry-run** — not Python only. **Go is added early** ("it's trending"), which forces a server tier.
> 3. **No AI features. Monetization/donations deferred** until real traffic exists (see REVENUE.md).
>
> Consequence: the app is now **two-tier** — a free, safe **browser tier** (Python/JS/TS via WASM) and a hardened
> **server tier** (Go and other compiled languages) that runs untrusted code in a sandbox on the home box. One
> playback UI serves both because every language emits the **same language-agnostic trace array** (see §4a).

---

## v1 scope (2026-07-04) — read this first

**Ships now — browser tier, no backend, no DB, no accounts:** a static SPA on Cloudflare's edge —
Python (Pyodide) + JS/TS (AST-instrumentation), the full player + 3D stage, **URL-hash sharing**,
client-side GIF export, a curated static example gallery, Cloudflare Web Analytics, and the legal-lite
pages. **This needs no home server at all.**

**Deferred behind proven demand — the server tier:** Go/C++/Java in the gVisor sandbox on the laptop.
Build it only once analytics show repeat demand — it's the riskiest, most expensive, unproven half.

**Deferred until a DB/accounts ever exist:** slug short-links (Module 9), dynamic per-code OG cards,
community submissions (Module 11 stays a *curated* gallery), saved library, classroom, self-hosted Umami,
and **Modules 17–20** (accounts, per-account quotas, email/campaigns, DPDP-for-email). The SQLite/Litestream
lines in §5 belong to this deferred tier. See §9 for the full launch-readiness list.

## 1. What it is

Paste code → press play → watch it execute step by step:
- the current **line** highlights in the editor
- **variables** update (just-changed values flash)
- **output** builds up as it prints
- **control flow** (if/else, loops) shows as a graph with the active branch lit
- a **3D stage** animates data structures — an element flies into an array, a frame stacks
  onto the call stack, a key drops into a dict; for Go: a slice window over a backing array,
  goroutine lanes, channels

Playback like a video: step forward/back, auto-play with speed, scrubber, keyboard shortcuts.
The player only ever walks a precomputed **trace** (an array of per-step snapshots) — it doesn't
care which language produced it.

## 2. Non-negotiable principles

- **Browser-first, server-only-when-forced (two-tier).** Python, JavaScript and TypeScript run in
  the browser (Pyodide / AST-instrumentation) — zero backend, fully sandboxed by WASM. Compiled/native
  languages (**Go first**) run **server-side in a hardened sandbox** because they have no in-browser line
  tracer. The no-backend, ~$0 promise holds for the **browser tier**; the server tier is opt-in per language.
- **Untrusted-code containment is a first-class module, not an afterthought.** Any server-executed language
  runs in gVisor with **no network**, an ephemeral filesystem, hard resource caps, and a global concurrency
  ceiling. A flood degrades to **"server busy"**, it never takes down the home box.
- **State rides in the URL (no DB for now).** Sharing = lz-string-compressed code in the URL hash — pure static,
  zero backend. Slug short-links (a small SQLite/KV) are **deferred** with the rest of the DB; when they land they
  store **source + metadata only** (never fat traces), with the hash kept as the offline fallback.
- **Anonymous-first — no signup, no accounts, no user DB (for now).** The entire core is anonymous: no login wall,
  ever, in front of the experience. Optional accounts + an email list are **deferred to future scope** (revisit only
  with real traffic; see the deferred Modules 17–20 and the DPDP/minors constraints before ever enabling them).
  Abuse is controlled **without** login — Turnstile + per-IP quotas + resource caps. The server-tier executor is
  **stateless and needs no DB.**
- **Never white-screen.** WebGL-first 3D, with a minimal flat fallback if WebGL is unavailable.
- **One clock.** A single playback timeline drives every panel in lockstep — the line, the variables, the
  flow node, and the 3D stage all read the same step index, for every language.

## 3. Architecture — the spine

```
                       ┌─ browser tier ─ Pyodide/Worker + Tracer (Python)  ────────┐
Editor ──Run──▶ route ─┤                 AST-instrumentation (JS / TS) ────────────┤
                       └─ server tier ── Cloudflare Tunnel → home API → bounded    │
                                         queue → gVisor worker → headless debugger │
                                         driver (Delve for Go, …) ────────────────┘
                                                        │
                                                Trace: steps[]  ◀── identical schema from either tier
                                                        │
                                                Playback clock
                                                        │
        ┌──────────────────────┬──────────────────────┬┴─────────────────┬────────────────────┐
        ▼                      ▼                      ▼                   ▼                    ▼
 Editor highlight      Variables/Output/Stack   Control-flow graph   3D WebGL stage    Go concurrency panels
```

Both tiers return the **same `steps[]` array**. The browser tier computes it locally; the server tier
**precomputes the whole trace once** and ships the JSON array to the browser — so playback and stepping
backward stay free client-side, exactly like the Python-only design.

## 4. Modules (each is interrogatable + extensible)

| # | Module | v1 job | Built to extend toward |
|---|--------|--------|------------------------|
| 1 | **Runtime** | Pyodide in a Web Worker; run code, kill-switch for infinite loops, stdin | JS/TS in-browser **and** a server execution tier (compile + headless-debugger in a sandbox) for compiled langs (Go first) behind the same run interface returning `steps[]` |
| 2 | **Tracer (browser)** | `sys.settrace` → per-line snapshot of vars, call stack, stdout; step cap (~10k) | server tracers (Delve JSON-RPC for Go, `TracePoint` for Ruby, JDI for Java, …) emit the **same schema** |
| 3 | **Trace model + event layer** | normalize steps; **diff consecutive snapshots → animation events** (append/pop/push/set-key) | Go/native detectors as new pure functions: slice-realloc, defer-push/run, panic/recover, chan-send/recv, goroutine-spawn/exit |
| 4 | **Playback clock** | one timeline state machine: step index, play/pause, speed, scrub, keyboard | bookmarks, breakpoints, "jump to next change", multi-lane minimap |
| 5 | **Editor** | CodeMirror 6; active-line highlight, inline value hints, breakpoint gutter | multi-file, themes, linting |
| 6 | **Panels** | variables, output, call stack | watch expressions, diff view, heap/object-identity graph |
| 7 | **Control-flow graph** | Python `ast` → nodes for if/for/while/def; active node lit | true 2D layout (dagre), nested scopes |
| 8 | **3D stage (WebGL)** | Three.js/r3f; array/stack/dict/string as animated meshes; device gate + flat fallback | trees, linked lists, graphs, recursion tree; **Go: slice-vs-backing-array, channels, goroutine lanes, pointers/aliasing, defer stack** |
| 9 | **Share** | slug short-links (SQLite) + share-to-exact-step; lz-string hash as offline fallback | server-rendered OG cards, oEmbed, QR |
| 10 | **Shell + pages** | routing; home = playground; examples, blog, about, legal; **pre-render content routes for SEO** | embed mode, i18n |
| 11 | **Content** | examples gallery (data) + blog posts (markdown) | **per-language example sets**, community-submitted examples, Bug Museum |
| 12 | **Analytics** | **Cloudflare Web Analytics** (cookieless, no DB) | self-hosted Umami later *(needs a DB — deferred)* |
| 13 | **Deploy** | Docker Compose on the home box; push-to-deploy via self-hosted runner | preview branches, custom domain |
| **14** | **Language registry** *(new)* | per-language descriptor: `id`, `site=browser\|server`, tracer, `needsSandbox`, examples, supported visuals; the app **routes** on this | pluggable community language packs |
| **15** | **Server execution tier** *(new)* | stateless home API + bounded queue + worker pool + two-stage **compile→execute** split + debugger drivers (Delve for Go) + warm sandbox pool | one reusable "headless-debugger-in-a-sandbox" harness every later server language plugs into |
| **16** | **Sandbox & isolation** *(new)* | **gVisor (runsc)**, `--network=none`, ephemeral rootfs, cgroup CPU/mem/pids caps, seccomp, concurrency ceiling, kill-switch/watchdog | optional Firecracker microVM nesting; per-IP quotas; Turnstile under load |
| **17** | **Accounts & identity** *(new)* | one-tap Google + GitHub OAuth + email magic-link (no passwords, no phone at signup); anonymous-session → account stitching; `is_adult` self-declaration; account-consent kept **separate** from marketing-consent (double opt-in) | teacher/classroom identities, profiles |
| **18** | **Anti-abuse & quotas** *(new)* | Cloudflare Turnstile on `/trace`; per-IP edge rate-limit + per-IP **daily server-tier quota** (Redis, ~5–10/day); per-user quota when signed in; anomaly log + blocklist — "see who exploits" **without** login | reputation scoring, adaptive limits |
| **19** | **Email & campaigns** *(new)* | external **ESP** (Amazon SES / Brevo for India; Resend/Postmark for magic-link) on a dedicated sending subdomain + SPF/DKIM/DMARC; double opt-in + one-click unsubscribe; consent audit trail; **18+-only, segmented list**. Mail **never** leaves the home IP | drip sequences, PlacementOS cross-sell |
| **20** | **Legal & privacy** *(new)* | DPDP Act 2023 + Rules 2025 duties (consent, notice, purpose limitation, retention/erasure, data-principal rights, ~72h breach notice), **minors handling (Sec 9 / 9(3))**, data minimization (email only). Lawyer review before collecting any email | GDPR posture if EU users onboard |

> **Modules 17–20 are DEFERRED (future scope)** — see the v1-scope box at the top. Note the *account-independent*
> legal-lite work (ToS, AUP, IP-only privacy, LICENSE, security.txt) is **NOT** deferred — it's needed at launch
> because you execute untrusted code and process IPs with zero accounts. See §9.7. The server-tier executor
> (Modules 15–16) is **stateless — it needs no DB**.

### 4a. Unified trace schema (the contract every tracer targets)

One language-agnostic array, `steps[]`, that **both** tiers emit and the player consumes unchanged.

```
Envelope: { schemaVersion, language, site: "browser"|"server",
            status: "ok"|"timeout"|"step-cap"|"output-cap"|"compile-error"|"runtime-error",
            diagnostics[], steps[] }

step:     { stepIndex, line, file, funcName,
            event: "line"|"call"|"return"|"exception",
            callStack: [{ funcName, line, frameId }],
            locals: { name -> { repr, type,
                                kind: "scalar"|"array"|"slice"|"map"|"dict"|"struct"|
                                      "pointer"|"string"|"channel"|"goroutine"|"ref",
                                ref?, addr? } },       // ref/addr = object identity for aliasing
            args:   { …same shape as locals },
            stdoutSoFar,
            threadOrGoroutineId?,                       // groups concurrent execution, one-clock intact
            animationEvents: [ { type, target, from?, to?, ref? } ] }
```

Design points: (1) `ref`/`addr` carries **object identity** so slice-backing-array sharing and pointer
aliasing render correctly across steps (Delve's `Variable.Addr` feeds this; Python `id()` and a JS
WeakRef tag feed the same field). (2) `kind` is a small **closed vocabulary** the 3D stage switches on —
a new language maps its types onto existing kinds instead of inventing renderers. (3) `animationEvents`
are diff-derived and language-agnostic; Go adds `slice-realloc`/`defer`/`panic`/`chan`/`goroutine`
detectors as new pure functions. (4) The server tier ships the **whole** `steps[]` in one response after
precompute, so client-side step-back stays free.

### 4b. Execution model — per-run container, not per-run VM

The server tier runs **one warm host (the laptop) → a small worker pool → a fresh ephemeral gVisor container
per run**, destroyed after. **Not** a full VM per run (won't fit 8 GB; boot + RAM floor dominate) and **not**
one shared long-lived VM/container (one hostile or runaway run corrupts shared state and hampers everyone —
no blast-radius containment). This is what the Go Playground and Judge0 effectively do; it buys VM-grade
per-run isolation at container cost (~tens of MB, sub-second start).

**Flow:** Cloudflare edge (Turnstile + per-IP rate-limit/quota) → home API → **bounded FIFO queue** (depth ~20,
sheds load as "server busy") → warm worker (pool of 2, cap 3–4 concurrent) → fresh `runsc` container
(`--network=none`, read-only rootfs + capped tmpfs, non-root, caps dropped; cgroup mem 256–384 MB / CPU ~1 core
/ pids ≤64 / wall 2–3 s) → **debugger-driven trace** (GDB-MI, JDI, Delve, TracePoint) → step-count/output cap
(~2000 steps / ~512 KB — tracing emits far more than run-and-capture) → return `steps[]`, tear the container down.

Structural rules:
- **Reserve, don't just limit.** Web/API/DB/tunnel get a guaranteed cgroup slice (`cpu.weight` + `memory.min`);
  the executor pool is capped (`memory.max`/`cpu.max`) so a runaway can **never** starve the frontend.
- **Keep personal data OFF this box.** The executor runs anonymous strangers' code; the **user/email DB lives on a
  separate host** (or a managed DB) with zero credentials shared to the executor. Treat the executor as hostile-by-design.
- **Images:** one small base + a thin, **content-hashed per-language layer** (Riju-style), version-pinned so shared
  traces stay reproducible; pre-pulled at boot. **Compile-cache** by source-hash → replayed shared links skip compile.
- **Warm pools** for slow starters (JVM/.NET: AppCDS/`-Xshare`, C1-only) so the student pays only their code's run.
- Realistic: **4–6 lean language images** fit the 128 GB SSD; the laptop is **only** the executor, the SPA lives on the edge.

## 5. Tech stack (decided)

**Browser tier:** Vite + React · CodeMirror 6 · Pyodide (jsdelivr CDN) · Three.js / react-three-fiber ·
Babel/Acorn (JS instrumentation) · esbuild-wasm (TS erasure) · lz-string. Content routes pre-rendered for SEO.

**Server tier (home box):** Linux + Docker/containerd with the **gVisor (runsc)** runtime · Go toolchain +
**Delve** (rpc2 JSON-RPC) · small stateless API (Go or Node/Fastify) · **SQLite (WAL)**, source+metadata only ·
bounded queue (in-memory / NATS / Redis) · **Litestream** off-box DB replication · **Umami** analytics ·
**Caddy** reverse proxy · **Cloudflare Tunnel** (`cloudflared`) so no ports open and the home IP is never in DNS ·
Cloudflare WAF/rate-limit/**Turnstile** in front. The SPA stays on Cloudflare's edge; the home box is off the
public path except `/trace` requests through the tunnel.

**Home hardware profile (i5 6th/7th gen · 8 GB RAM · 128 GB SSD):** RAM and disk are the binding constraints,
not virtualization. → **gVisor alone** as the sandbox boundary (Firecracker nesting is a later upgrade, KVM is
present but 8 GB is tight); **execution concurrency ceiling ~2**; discipline the 128 GB SSD (Go build-cache
eviction, `json-file` log rotation `max-size`/`max-file`, keep SQLite small, Litestream to Backblaze B2/S3);
laptop perks — internal battery = free UPS, set lid-close to "do nothing"; watch thermals under sustained builds.

## 6. Build order

> **Top-level gate:** launch **browser-only first** (edge-hosted, no laptop). Build the server tier (Go) **only
> when analytics show repeat demand** — it's the riskiest, most expensive, unproven half. See §9's sequencing note.

**Phase 0 — DONE / baseline:** Python in-browser (Pyodide + `settrace`). The schema-defining reference tracer.

**Day 1 — the engine + core UI (browser tier, shippable on its own)**
1. Scaffold Vite/React; Pyodide boots in a worker and prints "hello". (~1.5h)
2. Tracer: `settrace` → step array with safe variable snapshots + step cap + timeout. (~2h)
3. Editor + line highlight + variables + output + call-stack panels, wired to a step index. (~1.5h)
4. Playback bar: step/play/speed/scrub + keyboard. (~1h)
5. Control-flow graph from AST, active-node highlight. (~1.5h)
6. **URL-hash share (lz-string)** + example gallery + the **error/edge-state matrix** (§9.4); deploy the static playground to the edge. (~1.5h)

**Day 2 — the 3D stage + the site**
7. Trace-diff event layer feeding the stage. (~1.5h)
8. WebGL stage: array + stack animations (fly-in/out), device gate + flat fallback. (~3h)
9. Dict + string in the stage. (~1h)
10. Pages: examples, blog (seed posts), about, legal; pre-render for SEO. (~2h)
11. Polish, self-hosted analytics; point domain via Cloudflare Tunnel. (~1h)

**Phase 1 — extend the free/safe browser tier (no backend):** JavaScript (Babel/Acorn AST-instrumentation),
then TypeScript (esbuild-wasm erasure → source map → reuse the JS instrumenter). Do these **before** any
server work so the product keeps growing while the sandbox is engineered properly.

**Phase 2 — server tier + Go (the flagship; a separate, larger effort with real ops/security work):**
stand up the gVisor sandbox (`--network=none`, ephemeral rootfs, cgroup caps) → two-stage compile/execute
(module fetch locked, `CGO_ENABLED=0`, reject build tags) → Delve JSON-RPC driver stepping one source line at
a time → unified-schema serializer → Cloudflare Tunnel + bounded queue + concurrency cap → Go visuals
(slice/backing-array, goroutine lanes, channels, defer/panic, pointers). Building Go creates the reusable
harness every later server language reuses.

> The original ~2-day estimate covered **only the browser-tier v1**. The server tier and Go are a separate,
> larger effort — the hard part is the sandbox, not Delve.

**Language rollout order — ship few well, not all at once.** The shared harness (sandbox, queue, schema, UI) is
written once, but each server language is a real **debugger driver + value-renderer** maintained forever, so:
Python ✅ → JavaScript → TypeScript (all in-browser, zero server cost) → **Go** (Delve — the flagship you want,
and the cleanest driver to prove the harness) → **C/C++** (GDB-MI) + **Java** (JDI) — the highest placement-prep
demand → Ruby (`TracePoint`, cheap) → SQL. **Defer Rust and C#/.NET** (heaviest toolchains/disk, each its own
tracer). Realistic launch: **4–5 languages done well.** "All languages as *step-tracing*" is a multi-year effort,
not a launch promise — "all languages as *run-and-capture*" is what Judge0 already sells, and is **not** Codelapse.

## 7. Open questions to interrogate (add answers here)

- Concurrency ceiling + per-IP caps starting values on the actual laptop (start at 2 workers)?
- Warm sandbox / warm-runtime pool vs cold-start latency budget (`go build` dominates at ~300ms–1.5s)?
- How to present nondeterministic goroutine scheduling honestly (shipped policy: single-goroutine stepping
  + `ListGoroutines()` snapshot each stop; other goroutines shown as lanes advancing opaquely)?
- Trace-array size cap for network transfer of server traces (step cap + output cap)?
- gVisor-only vs later Firecracker nesting given 8 GB RAM (start gVisor-only)?
- Which structures make the day-1 3D cut beyond array/stack? (dict + string are cheap)
- Short links now (SQLite on the box) — done; do we also add a KV edge cache?
- Name lock: Codelapse vs alternatives.

## 8. Cost to run

- **Browser tier stays $0 compute** (Python/JS/TS run in the visitor's browser).
- **Server tier is NOT free:** home-server electricity + residential bandwidth/uptime limits + (most expensively)
  maintenance/ops time and a real **security burden** (running untrusted code). Cloudflare Tunnel/WAF/Turnstile
  and edge caching remain free tier. Domain ~$12/yr.
- Net: the compiled-language feature **trades the no-backend simplicity for fidelity**. Keep the browser tier
  as the always-free, always-up core; the home box is the opt-in engine for Go and friends.

See REVENUE.md for how the modest server cost eventually gets covered (deferred until there's traffic).

## 9. Launch-readiness & gaps (2026-07-04 completeness pass)

**Sequencing gate (the highest-leverage decision):** ship **browser-only first** (Python + JS/TS on the edge,
no laptop involved), validate demand, and build the **server tier (Go/compiled) only when analytics show repeat
demand.** Everyone scrutinized sandbox *isolation*; nobody stress-tested the server tier's *capacity + uptime* —
an 8 GB residential laptop with ~2 concurrent slots, single ISP, and India power cuts is both the bottleneck and
the single point of failure the moment Codelapse gets traction. Launching browser-only de-risks the whole two-tier
bet at near-zero cost.

### 9.1 Browser-tier security model (the no-DB cut moved the attack surface HERE)
Shared links now carry **source** in the URL hash, so opening one **re-runs a stranger's code in the viewer's
browser**. WASM sandboxes CPU/memory but **not the network**. Non-negotiable:
- **Never auto-run shared code** — land on a "▶ Press play to run this shared code" gate.
- Run **all** browser-tier code in a **Web Worker with `fetch`/`XHR`/`WebSocket` deleted** from the worker global
  and Pyodide `pyfetch` disabled; strict **CSP `connect-src 'none'`** in the worker as backstop.
- **DECIDED — hybrid transfer:** embed a compressed **precomputed trace** in the hash when it fits, so viewers
  **replay, not re-run** (closes the drive-by *and* the reproducibility hole); **fall back to source + the
  press-play gate** for large programs. Either way, execution is only ever in the network-stripped worker.
- Server tier stays **`--network=none` always**; enabling any egress needs fresh security + legal review.

### 9.2 Determinism & reproducibility
A source-only link re-runs against whatever runtime/inputs the viewer has → a **different dry-run per viewer.**
Fix: self-host + **fully pin** Pyodide + packages + Babel/Acorn/esbuild; stamp `runtimeVersion` in the envelope
and warn on mismatch; **seed+freeze `random`, freeze the clock, capture `stdin` into the link.** Also a
**package/import allowlist** (no `micropip` network installs at run time).

### 9.3 Trace memory safety (schema delta to §4a)
`stdoutSoFar` as full cumulative output per step is **O(n²)**; full snapshots per step to 10k blow up 8 GB tabs.
Change: store stdout as a **per-step delta**, locals as a **per-step diff** with structural sharing; add a **byte
budget** alongside the step cap; cap per-value **repr length + element count**; honest "trace truncated" banner.

### 9.4 Error & edge-state matrix (errors are the common path for students)
A designed, plain-language component per state: syntax error → mapped to line; **uncaught exception → still show
the trace up to the failing line** (the teaching moment); step-cap → "your loop ran too long, here"; output-cap;
unsupported feature → "file I/O isn't available in the browser sandbox"; WebGL-unavailable → flat 2D; empty
program; tab-backgrounded. Plus a **tracer fixture suite** (deep recursion, generators/coroutines, big list/dict,
cyclic structure, multi-frame exception) that must pass before launch, with recursion-depth + repr caps as
first-class statuses.

### 9.5 Mobile & accessibility (for this audience, this IS the product)
India audience is mobile-first low/mid Android. Design now: **tab/accordion switcher** (Code/Variables/Output/3D)
not 4 simultaneous panels; sticky bottom touch playback bar; **3D defaults to flat-2D on mobile** with opt-in;
frame-rate cap + pause-off-tab; device-tier detect. A11y: **color-blind-safe palette + a non-color cue** on every
signal; **`prefers-reduced-motion`** (no auto-spin); a **screen-reader "trace transcript"** table view (doubles as
a low-bandwidth fallback); full keyboard operability + visible focus. Pyodide load UX: self-host + immutable cache
+ service worker + explicit "loading Python engine ~6 MB, one-time" progress; lazy-load only when Python is run.

### 9.6 First-run, content & UX (the least-specified, highest-leverage layer)
- **First-run:** a curated default program that **auto-plays once slowly** on load + a 3–4 step dismissible
  coach-mark tour (localStorage-remembered) + designed empty states for every panel.
- **Seed curriculum = a first-class deliverable with an OWNER:** ~20–30 hand-authored placement-prep examples,
  each chosen to showcase a specific 3D visual (two-pointer, sorts incl. recursion trees, stack/queue, hashmap,
  binary search, recursion, linked list, BST). The 3D stage only shines on the right examples. Content licensed
  CC0/MIT (code) + CC BY (prose).
- **Long-trace navigation in v1 (not deferred):** "jump to next change"/"next line", loop-iteration collapse +
  scrubber markers, a density minimap. **CFG scaling:** node/edge ceiling → scope to the active function.
- **Keyboard map:** Space play/pause, ←/→ step, Shift+←/→ jump-to-change, `,`/`.` speed — active only when
  playback (not the editor) is focused; `?` cheatsheet. **Voice guide:** encouraging, plain, ESL-friendly; map
  common errors to friendly explanations; all strings in a file for later i18n.
- **stdin panel:** detect `input()`/`Scanner`, collect a stdin blob **before** tracing, run deterministically.

### 9.7 Legal-lite — needed at LAUNCH, not deferred with the DB
Running untrusted code + processing IPs triggers obligations with **zero accounts**. The repo currently has **no
LICENSE file** (= all-rights-reserved). Ship before public launch: **/terms** (license to run code, as-is/no-warranty,
liability cap, India governing law, right to kill runs, 13+ floor, **educational-accuracy disclaimer** since the
trace is admittedly lossy for concurrency/floats), **/acceptable-use**, lean **/privacy** (IP processed transiently
for anti-abuse with a real short **TTL**, cookieless analytics, code not stored server-side, Cloudflare + Turnstile
as processors, disclose Cloudflare security cookies), **/.well-known/security.txt** → a monitored **non-personal**
abuse/grievance inbox (India IT Act §79 safe-harbor is conditional on it), and a **LICENSE (Apache-2.0)** +
THIRD-PARTY notices (Pyodide MPL-2.0; CodeMirror/Three.js/lz-string MIT; keep GDB **server-side-only** so its GPLv3
never touches the distributable). **Clear name/trademark/domain** (India IP-India + USPTO + EUIPO, classes 9/42;
domain + GitHub/npm/PyPI handles) before locking "Codelapse".

### 9.8 Sharing without a DB
Static **generic branded OG card** now (a per-code card needs a query-key stateless Worker or the deferred server
render — the hash is never sent to the server); **client-side QR** of the hash; **URL-length guard** with a
"copy code / download `.codelapse`" fallback (WhatsApp truncates long links silently). Optional un-defer: a tiny
**content-hash file-cache/KV** (holds no user data, not a relational DB) fixes both hash-length pain and the
server-tier viral-link DoS below.

### 9.9 Must-do before a public (browser-tier) launch
1. Shared-link execution safety (§9.1). 2. Legal-lite pages + LICENSE (§9.7). 3. Error/edge-state matrix + tracer
fixtures (§9.4). 4. Determinism/pinning + import allowlist (§9.2). 5. Trace memory safety (§9.3). 6. WebGL fallback
+ reduced-motion + color-blind palette (§9.5). 7. **Prove edge independence** — power the laptop fully off, confirm
a Python program plays end-to-end from the edge. 8. First-run + ~20–30 seed examples (§9.6). 9. Name/domain cleared.

### 9.10 Deferred until (and if) the server tier ships
Content-hash **trace cache pushed to the Cloudflare edge** (viral Go links compute once, replay off-box);
self-healing warm pool with **recycle-after-each-run**; a validated **8 GB memory budget** (likely **Go-only** for
v1); **named authenticated tunnel only**; tested `--network=none` egress; CVE-patch runbook + weekly image rebuilds
(Trivy/Grype gate); external uptime monitoring + off-box metrics; laptop physical care (lid/thermals/UPS-battery);
tunnel-token secret hygiene + full-disk encryption; pull-based CI/CD through the tunnel; Docker log rotation +
disk>85 % alert. DR posture is relaxed (no user data): all config in git as IaC; recovery = flash a laptop, clone,
inject token; the trace cache is disposable.

### 9.11 Decisions (2026-07-04)
**Locked:**
- **Sequencing:** ✅ **browser-only first**; the Go/server tier is **demand-gated** (build only when analytics show repeat demand).
- **Share model:** ✅ **hybrid** — embed a compressed precomputed **trace** in the hash when it fits (viewers **replay**: safest + reproducible); **fall back to source + the press-play gate** for large programs. Both paths execute only in the network-stripped worker (§9.1).
- **GIF export:** ✅ **free client-side GIF export in v1** (canvas/WebGL capture + gif.js in a worker, zero backend); high-res MP4 stays a future server-tier feature.
- **Name:** ✅ **"Codelapse" is locked** — build brand/SEO on it.

**Still open (mostly server-tier — revisit when that tier is on the table):**
- Un-defer a tiny content-hash cache/KV (no user data) for short links + off-box viral-link caching?
- OG cards: static generic now vs a stateless Worker rendering per-code cards from a query-key? *(leaning static generic for v1)*
- IP retention TTL for the anti-abuse store (only exists once the server tier does).
- Go-only v1 for the server tier pending a load-tested memory budget?
