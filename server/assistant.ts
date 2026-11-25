/**
 * The AI assistant endpoint, written against the standard Fetch API
 * (Request -> Response) so the same code runs as a Vercel function
 * (api/assistant.ts) and inside the Vite dev server (vite.config.ts).
 *
 * API keys only ever live here, server-side. The browser sends the student's
 * code + a small run snapshot; we validate it, build the prompt, and stream
 * plain text back from whichever provider is configured (server/providers.ts).
 */
import { parseAssistantRequest, STREAM_ERROR_MARK } from '../src/assistant/protocol.js';
import { buildPrompt, effortFor } from '../src/assistant/prompt.js';
import { ProviderError, selectProvider, type ProviderEnv } from './providers.js';

export type AssistantEnv = ProviderEnv;

const MAX_BODY_BYTES = 100_000;

/* ---------------------------------------------------------- rate limit -- */

// Best-effort, per-instance sliding window. Serverless instances don't share
// memory, so this bounds bursts from one client rather than enforcing a hard
// global quota — put a shared store (e.g. Upstash/Redis) in front for that.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

export function rateLimited(clientId: string, now = Date.now()): boolean {
  const recent = (hits.get(clientId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(clientId, recent);
    return true;
  }
  recent.push(now);
  hits.set(clientId, recent);
  if (hits.size > 5_000) {
    // drop the oldest entries so memory stays bounded
    for (const key of hits.keys()) {
      hits.delete(key);
      if (hits.size <= 4_000) break;
    }
  }
  return false;
}

/* ------------------------------------------------------------- handler -- */

const json = (status: number, body: Record<string, unknown>, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

export async function handleAssistant(
  request: Request,
  env: AssistantEnv,
  clientId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'Use POST.' }, { allow: 'POST' });
  }
  const provider = selectProvider(env);
  if (!provider) {
    return json(503, {
      error:
        'The AI assistant is not set up yet. Paste a free Gemini key into GEMINI_API_KEY in .env.local (see README), then restart the server.',
    });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request is too large.' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Request body must be JSON.' });
  }
  const parsed = parseAssistantRequest(body);
  if (!parsed.ok) return json(400, { error: parsed.error });

  if (rateLimited(clientId)) {
    return json(
      429,
      { error: 'You have asked a lot of questions in a short time. Please wait a few minutes.' },
      { 'retry-after': '120' },
    );
  }

  const { system, messages } = buildPrompt(parsed.value);
  const signal = request.signal;
  const encoder = new TextEncoder();
  let iterator: AsyncGenerator<string> | null = null;

  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        iterator = provider.generate({
          system,
          messages,
          effort: effortFor(parsed.value.mode),
          signal,
        });
        for await (const text of iterator) controller.enqueue(encoder.encode(text));
      } catch (err) {
        if (!signal.aborted) {
          if (!(err instanceof ProviderError)) console.error('[assistant]', err);
          const message =
            err instanceof ProviderError
              ? err.message
              : 'Something went wrong while generating the answer.';
          controller.enqueue(encoder.encode(STREAM_ERROR_MARK + message));
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed because the client went away
        }
      }
    },
    cancel() {
      void iterator?.return(undefined);
    },
  });

  return new Response(bodyStream, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      // header values must be plain ASCII
      'x-ai-provider': `${provider.id}/${provider.model}`.replace(/[^ -~]/g, '?'),
    },
  });
}
