import { STREAM_ERROR_MARK, STREAM_RESET_MARK, type AssistantRequest } from './protocol';

export class AssistantError extends Error {}

/** Waits before each automatic retry of a request that couldn't connect. */
export const CONNECT_RETRY_DELAYS_MS = [600, 1500];

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

/**
 * Send the question. A request that fails before any reply (server
 * restarting, a dropped connection, a stale keep-alive socket) never reached
 * the AI, so it is safe to quietly try again a couple of times.
 */
async function connect(req: AssistantRequest, signal: AbortSignal): Promise<Response> {
  const body = JSON.stringify(req);
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      const wait = CONNECT_RETRY_DELAYS_MS[attempt];
      if (wait === undefined) {
        throw new AssistantError(
          "Couldn't reach the assistant. Check your internet connection, then press Retry.",
        );
      }
      await sleep(wait, signal);
      if (signal.aborted) throw err;
    }
  }
}

/**
 * POST a question to /api/assistant and stream the answer. `onText` receives
 * the full answer-so-far each time new text arrives. Resolves when the answer
 * is complete; rejects with AssistantError for anything the student should see.
 */
export async function streamAssistant(
  req: AssistantRequest,
  onText: (answerSoFar: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await connect(req, signal);

  if (!res.ok) {
    let message = `The assistant is unavailable (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      if (res.status === 404) {
        message = 'The assistant server route was not found. Start the app with `npm run dev`.';
      }
    }
    throw new AssistantError(message);
  }
  if (!res.body) throw new AssistantError('The assistant sent an empty response.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    // The server retried after the AI failed mid-answer: start over.
    const reset = text.lastIndexOf(STREAM_RESET_MARK);
    if (reset !== -1) text = text.slice(reset + STREAM_RESET_MARK.length);
    const mark = text.indexOf(STREAM_ERROR_MARK);
    if (mark !== -1) {
      const partial = text.slice(0, mark);
      if (partial) onText(partial);
      throw new AssistantError(text.slice(mark + STREAM_ERROR_MARK.length) || 'Unknown error.');
    }
    // never show half of a control marker split across network chunks
    const nul = text.indexOf('\u0000');
    onText(nul === -1 ? text : text.slice(0, nul));
  }
  text += decoder.decode();
  return text.split('\u0000').join('');
}
