/**
 * AI providers for the assistant. Each one turns the same prompt (system text
 * + chat turns) into a stream of answer text, so the endpoint doesn't care
 * which company answers.
 *
 *   gemini    — Google Gemini API (free tier available)       GEMINI_API_KEY
 *   groq      — Groq, open models (free tier available)       GROQ_API_KEY
 *   anthropic — Claude (paid API)                             ANTHROPIC_API_KEY
 */
import Anthropic from '@anthropic-ai/sdk';
import { ApiError as GeminiApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import Groq from 'groq-sdk';
import { STREAM_RESET_MARK, type ChatTurn } from '../src/assistant/protocol.js';

export type ProviderId = 'gemini' | 'groq' | 'anthropic';

export interface ProviderEnv {
  /** force one provider; otherwise the first one with a key is used */
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

export interface GenerateArgs {
  system: string;
  messages: ChatTurn[];
  /** 'medium' for deeper questions (bugs, complexity, line by line) */
  effort: 'low' | 'medium';
  signal: AbortSignal;
}

/** Thrown for problems the student should see as a friendly sentence. */
export class ProviderError extends Error {
  constructor(
    message: string,
    /** out of quota / overloaded — worth trying another provider */
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** An API error from any provider, as a student-friendly ProviderError. */
function apiError(status: number | undefined, provider: string): ProviderError {
  return new ProviderError(
    statusMessage(status, provider),
    status === 429 || (status !== undefined && status >= 500),
  );
}

export interface Provider {
  id: ProviderId;
  model: string;
  generate(args: GenerateArgs): AsyncGenerator<string>;
}

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-3.8-flash',
  groq: 'openai/gpt-oss-120b',
  anthropic: 'claude-opus-5-5',
};

const MAX_OUTPUT_TOKENS = 8_192;

const clean = (v: string | undefined) => (v ?? '').trim();

/** Pick the provider from the environment, or null when no key is set. */
export function selectProvider(env: ProviderEnv): Provider | null {
  const forced = clean(env.AI_PROVIDER).toLowerCase();
  const keys: Record<ProviderId, string> = {
    gemini: clean(env.GEMINI_API_KEY),
    groq: clean(env.GROQ_API_KEY),
    anthropic: clean(env.ANTHROPIC_API_KEY),
  };
  const order: ProviderId[] =
    forced === 'gemini' || forced === 'groq' || forced === 'anthropic'
      ? [forced]
      : ['gemini', 'groq', 'anthropic'];
  const make = (id: ProviderId): Provider => {
    switch (id) {
      case 'gemini':
        return gemini(keys.gemini, clean(env.GEMINI_MODEL) || DEFAULT_MODELS.gemini);
      case 'groq':
        return groq(keys.groq, clean(env.GROQ_MODEL) || DEFAULT_MODELS.groq);
      case 'anthropic':
        return anthropic(keys.anthropic, clean(env.ANTHROPIC_MODEL) || DEFAULT_MODELS.anthropic);
    }
  };
  const ids = order.filter((p) => keys[p]);
  if (ids.length === 0) return null;
  // Free providers race each other (fastest answer wins); the paid one
  // (Claude) never races — it only steps in if every free one fails.
  const free = ids.filter((p) => p !== 'anthropic').map(make);
  const paid = ids.includes('anthropic') ? make('anthropic') : null;
  const front = free.length > 1 ? raceProviders(free) : free[0];
  if (!front) return paid;
  return paid ? withBackups([front, paid]) : front;
}

/** Errors that another provider can't fix (bad key) are worth surfacing. */
const isRetryable = (err: unknown) => (err instanceof ProviderError ? err.retryable : true);

/**
 * Ask every provider at once; whichever starts answering first wins and the
 * others are stopped immediately. If the winner then fails mid-answer, the
 * remaining providers take over one by one (the partial text is replaced).
 */
export function raceProviders(providers: Provider[]): Provider {
  return {
    id: providers[0].id,
    model: providers.map((p) => `${p.id}/${p.model}`).join(' | '),
    async *generate(args) {
      const ctrls = providers.map(() => new AbortController());
      const stopAll = () => ctrls.forEach((c) => c.abort());
      args.signal.addEventListener('abort', stopAll);
      const gens = providers.map((p, i) => p.generate({ ...args, signal: ctrls[i].signal }));

      // Each contender runs until its first real piece of text.
      const firstText = async (i: number) => {
        for (;;) {
          const r = await gens[i].next();
          if (r.done) throw new ProviderError("The assistant couldn't answer that.", true);
          if (r.value !== STREAM_RESET_MARK) return { i, text: r.value };
        }
      };
      const pending = new Map<number, Promise<{ i: number; text: string }>>();
      providers.forEach((_, i) => {
        const p = firstText(i);
        p.catch(() => {}); // a stopped loser rejecting later is expected
        pending.set(i, p);
      });

      let winner: { i: number; text: string } | null = null;
      let lastErr: unknown = null;
      try {
        while (!winner && pending.size > 0) {
          const settled = await Promise.race(
            [...pending.entries()].map(([i, p]) =>
              p.then(
                (v) => ({ ok: true as const, i, v }),
                (e: unknown) => ({ ok: false as const, i, e }),
              ),
            ),
          );
          if (settled.ok) winner = settled.v;
          else {
            pending.delete(settled.i);
            // keep a "bad key" style error over a quota one, so it surfaces
            if (!lastErr || isRetryable(lastErr)) lastErr = settled.e;
          }
        }
      } finally {
        // stop everyone who didn't win (all of them if nobody did)
        providers.forEach((_, i) => {
          if (winner?.i !== i) {
            ctrls[i].abort();
            void gens[i].return(undefined).catch(() => {});
          }
        });
      }

      try {
        if (!winner) throw lastErr ?? new ProviderError('No AI provider answered.', true);
        if (args.signal.aborted) return;
        console.info(`[assistant] ${providers[winner.i].id} answered first`);
        yield winner.text;
        try {
          for await (const t of { [Symbol.asyncIterator]: () => gens[winner!.i] }) yield t;
        } catch (err) {
          // the winner broke off mid-answer: the others take over, in order
          const rest = providers.filter((_, i) => i !== winner!.i);
          if (args.signal.aborted || !isRetryable(err) || rest.length === 0) throw err;
          yield STREAM_RESET_MARK;
          yield* withBackups(rest).generate(args);
        }
      } finally {
        args.signal.removeEventListener('abort', stopAll);
      }
    },
  };
}

/**
 * Every configured provider, in order: when one is out of quota or failing
 * (even mid-answer), the next one answers instead. With GEMINI_API_KEY and
 * GROQ_API_KEY both set, Groq backs Gemini up.
 */
export function withBackups(providers: Provider[]): Provider {
  return {
    id: providers[0].id,
    model: providers.map((p) => `${p.id}/${p.model}`).join(' > '),
    async *generate(args) {
      for (let i = 0; i < providers.length; i++) {
        let any = false;
        try {
          for await (const text of providers[i].generate(args)) {
            if (text !== STREAM_RESET_MARK) any = true;
            yield text;
          }
          return;
        } catch (err) {
          if (args.signal.aborted) throw err;
          // bad key / bad request won't be fixed by another provider… but a
          // quota, overload or network failure will
          const worthRetry = err instanceof ProviderError ? err.retryable : true;
          if (!worthRetry || i === providers.length - 1) throw err;
          console.warn(`[assistant] ${providers[i].id} failed, trying ${providers[i + 1].id}`);
          if (any) yield STREAM_RESET_MARK; // drop the half-finished answer
        }
      }
    },
  };
}

/* -------------------------------------------------------------- shared -- */

function statusMessage(status: number | undefined, provider: string): string {
  if (status === 401 || status === 403) {
    return `The AI assistant is misconfigured: the ${provider} API key on the server is invalid or not allowed to use this model.`;
  }
  if (status === 429) {
    return 'The free AI quota is used up for now (too many questions). Please try again in a minute — or tomorrow if the daily limit was reached.';
  }
  if (status === 400) {
    return 'The AI could not process this request. Try a shorter question or clear the chat.';
  }
  if (status === 404) {
    return `The configured ${provider} model was not found. Check the model name in your settings.`;
  }
  if (status !== undefined && status >= 500) {
    return 'The AI service is having trouble right now. Please try again shortly.';
  }
  return 'Something went wrong while generating the answer.';
}

/* -------------------------------------------------------------- Gemini -- */

/** Tried in order when the chosen model is overloaded or out of free quota. */
export const GEMINI_FALLBACKS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];

/** Busy/quota errors worth retrying on another model. */
const retryable = (status: number) => status === 429 || status === 503 || status === 500;

/**
 * Models that recently said "quota used up" are skipped for a while instead
 * of being tried (and failing) on every question — faster answers, and fewer
 * wasted calls. Per server instance; resets when it restarts.
 */
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000;
const exhaustedUntil = new Map<string, number>();

export function orderGeminiChain(chain: string[], now = Date.now()): string[] {
  const fresh = chain.filter((m) => (exhaustedUntil.get(m) ?? 0) <= now);
  // if every model is cooling down, still try them all (quotas may have reset)
  return fresh.length > 0 ? fresh : chain;
}
export function markExhausted(model: string, now = Date.now()) {
  exhaustedUntil.set(model, now + QUOTA_COOLDOWN_MS);
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

function gemini(apiKey: string, model: string): Provider {
  const client = new GoogleGenAI({ apiKey });
  const fullChain = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)];
  return {
    id: 'gemini',
    model,
    async *generate({ system, messages, effort, signal }) {
      const chain = orderGeminiChain(fullChain);
      let retriedBusy = false;
      for (let i = 0; i < chain.length; i++) {
        let any = false;
        try {
          const stream = await client.models.generateContentStream({
            model: chain[i],
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            config: {
              systemInstruction: system,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              // Flash models "think" silently before writing — that's most of
              // the wait. Explanations need almost none; bugs, complexity and
              // writing code get a little.
              thinkingConfig: {
                thinkingLevel: effort === 'low' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
              },
              abortSignal: signal,
            },
          });
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              any = true;
              yield text;
            }
          }
          if (!any) throw new ProviderError("The assistant couldn't answer that. Try rephrasing.");
          return;
        } catch (err) {
          if (err instanceof ProviderError || signal.aborted) throw err;
          if (err instanceof GeminiApiError) {
            if (err.status === 429) markExhausted(chain[i]);
            if (retryable(err.status)) {
              const hasNext = i < chain.length - 1;
              // the last model was only briefly overloaded → one more try
              const retrySame = !hasNext && err.status !== 429 && !retriedBusy;
              if (hasNext || retrySame) {
                // Failed mid-answer: tell the app to drop the partial text.
                if (any) yield STREAM_RESET_MARK;
                if (retrySame) {
                  retriedBusy = true;
                  await pause(900, signal);
                  if (signal.aborted) throw err;
                  i--;
                }
                continue;
              }
            }
            // Google reports a bad key as 400 INVALID_ARGUMENT, not 401.
            const badKey = /API[_ ]KEY/i.test(err.message);
            throw apiError(badKey ? 401 : err.status, 'Gemini');
          }
          throw err;
        }
      }
    },
  };
}

/* ---------------------------------------------------------------- Groq -- */

function groq(apiKey: string, model: string): Provider {
  const client = new Groq({ apiKey });
  return {
    id: 'groq',
    model,
    async *generate({ system, messages, effort, signal }) {
      try {
        const stream = await client.chat.completions.create(
          {
            model,
            max_completion_tokens: MAX_OUTPUT_TOKENS,
            // reasoning models (gpt-oss): think briefly — quick answers matter more
            reasoning_effort: effort === 'low' ? 'low' : 'medium',
            stream: true,
            messages: [
              { role: 'system', content: system },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          },
          { signal },
        );
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield text;
        }
      } catch (err) {
        if (signal.aborted) throw err;
        if (err instanceof Groq.APIError) {
          throw apiError(err.status, 'Groq');
        }
        throw err;
      }
    },
  };
}

/* ----------------------------------------------------------- Anthropic -- */

/** Models that accept the server-side refusal fallback. */
const supportsFallback = (model: string) => /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model);

function anthropic(apiKey: string, model: string): Provider {
  const client = new Anthropic({ apiKey });
  return {
    id: 'anthropic',
    model,
    async *generate({ system, messages, effort, signal }) {
      const fallback = supportsFallback(model);
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 16_000,
          // On a safety decline, re-run on a suitable fallback model in the same call.
          ...(fallback
            ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
          output_config: { effort },
          system,
          messages,
        },
        { signal },
      );
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          throw new ProviderError("The assistant can't help with that request.");
        }
        if (final.stop_reason === 'max_tokens') {
          yield '\n\n_(Answer cut short — ask a narrower question.)_';
        }
      } catch (err) {
        if (err instanceof ProviderError || signal.aborted) throw err;
        if (err instanceof Anthropic.APIError) {
          throw apiError(err.status, 'Anthropic');
        }
        throw err;
      }
    },
  };
}
