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
import type { ChatTurn } from '../src/assistant/protocol';

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
export class ProviderError extends Error {}

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
  const id = order.find((p) => keys[p]);
  if (!id) return null;

  switch (id) {
    case 'gemini':
      return gemini(keys.gemini, clean(env.GEMINI_MODEL) || DEFAULT_MODELS.gemini);
    case 'groq':
      return groq(keys.groq, clean(env.GROQ_MODEL) || DEFAULT_MODELS.groq);
    case 'anthropic':
      return anthropic(keys.anthropic, clean(env.ANTHROPIC_MODEL) || DEFAULT_MODELS.anthropic);
  }
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

function gemini(apiKey: string, model: string): Provider {
  const client = new GoogleGenAI({ apiKey });
  const chain = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)];
  return {
    id: 'gemini',
    model,
    async *generate({ system, messages, effort, signal }) {
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
            // Busy before any text arrived → quietly try the next model.
            if (!any && retryable(err.status) && i < chain.length - 1) continue;
            // Google reports a bad key as 400 INVALID_ARGUMENT, not 401.
            const badKey = /API[_ ]KEY/i.test(err.message);
            throw new ProviderError(statusMessage(badKey ? 401 : err.status, 'Gemini'));
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
    async *generate({ system, messages, signal }) {
      try {
        const stream = await client.chat.completions.create(
          {
            model,
            max_completion_tokens: MAX_OUTPUT_TOKENS,
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
          throw new ProviderError(statusMessage(err.status, 'Groq'));
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
          throw new ProviderError(statusMessage(err.status, 'Anthropic'));
        }
        throw err;
      }
    },
  };
}
