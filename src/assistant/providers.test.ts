// @vitest-environment node
// Server code — the provider SDKs refuse to construct in a browser-like env.
/* eslint-disable require-yield -- fake providers that fail before answering */
import { describe, expect, it } from 'vitest';
import { handleAssistant } from '../../server/assistant';
import {
  DEFAULT_MODELS,
  markExhausted,
  orderGeminiChain,
  ProviderError,
  selectProvider,
  withBackups,
  type Provider,
  type ProviderId,
} from '../../server/providers';
import { STREAM_RESET_MARK } from './protocol';

describe('selectProvider', () => {
  it('returns null when no key is configured', () => {
    expect(selectProvider({})).toBeNull();
    expect(selectProvider({ GEMINI_API_KEY: '   ' })).toBeNull();
  });

  it('uses Gemini alone when it is the only key', () => {
    const p = selectProvider({ GEMINI_API_KEY: 'g' });
    expect(p?.id).toBe('gemini');
    expect(p?.model).toBe(DEFAULT_MODELS.gemini);
  });

  it('puts Gemini first and the other keys behind it as backups', () => {
    const p = selectProvider({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', ANTHROPIC_API_KEY: 'a' });
    expect(p?.id).toBe('gemini');
    expect(p?.model).toBe(
      `gemini/${DEFAULT_MODELS.gemini} → groq/${DEFAULT_MODELS.groq} → anthropic/${DEFAULT_MODELS.anthropic}`,
    );
  });

  it('falls back to Groq, then Anthropic', () => {
    expect(selectProvider({ GROQ_API_KEY: 'q', ANTHROPIC_API_KEY: 'a' })?.id).toBe('groq');
    expect(selectProvider({ ANTHROPIC_API_KEY: 'a' })?.id).toBe('anthropic');
  });

  it('honours AI_PROVIDER and model overrides', () => {
    const p = selectProvider({
      AI_PROVIDER: 'Anthropic',
      GEMINI_API_KEY: 'g',
      ANTHROPIC_API_KEY: 'a',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
    });
    expect(p?.id).toBe('anthropic');
    expect(p?.model).toBe('claude-haiku-5-5');
    // forced provider without its key → not configured
    expect(selectProvider({ AI_PROVIDER: 'groq', GEMINI_API_KEY: 'g' })).toBeNull();
  });
});

describe('handleAssistant', () => {
  const post = (body: unknown) =>
    new Request('http://localhost/api/assistant', {
      method: 'POST',
      body: JSON.stringify(body),
    });

  it('explains how to set up when no key is configured', async () => {
    const res = await handleAssistant(post({}), {}, 'test');
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/GEMINI_API_KEY/);
  });

  it('rejects other methods and invalid bodies', async () => {
    const get = await handleAssistant(
      new Request('http://localhost/api/assistant'),
      { GEMINI_API_KEY: 'g' },
      'test',
    );
    expect(get.status).toBe(405);
    const bad = await handleAssistant(post({ mode: 'nope' }), { GEMINI_API_KEY: 'g' }, 'test');
    expect(bad.status).toBe(400);
  });
});

describe('Gemini quota cooldown', () => {
  it('skips models that recently ran out of quota, but never skips all', () => {
    const chain = ['m-a', 'm-b', 'm-c'];
    const now = 1_000_000;
    expect(orderGeminiChain(chain, now)).toEqual(chain);
    markExhausted('m-a', now);
    expect(orderGeminiChain(chain, now + 1000)).toEqual(['m-b', 'm-c']);
    markExhausted('m-b', now);
    markExhausted('m-c', now);
    expect(orderGeminiChain(chain, now + 1000)).toEqual(chain); // all cooling → try all
    expect(orderGeminiChain(chain, now + 11 * 60 * 1000)).toEqual(chain); // cooled down
  });
});

describe('withBackups', () => {
  const args = () => ({
    system: 's',
    messages: [],
    effort: 'low' as const,
    signal: new AbortController().signal,
  });
  const fake = (id: ProviderId, run: () => AsyncGenerator<string>): Provider => ({
    id,
    model: id,
    generate: run,
  });
  const collect = async (p: Provider) => {
    const out: string[] = [];
    for await (const t of p.generate(args())) out.push(t);
    return out;
  };

  it('uses the backup when the first provider is out of quota', async () => {
    const p = withBackups([
      fake('gemini', async function* () {
        throw new ProviderError('quota', true);
      }),
      fake('groq', async function* () {
        yield 'from groq';
      }),
    ]);
    expect(await collect(p)).toEqual(['from groq']);
  });

  it('drops a half-finished answer before the backup answers', async () => {
    const p = withBackups([
      fake('gemini', async function* () {
        yield 'half an ans';
        throw new ProviderError('overloaded', true);
      }),
      fake('groq', async function* () {
        yield 'whole answer';
      }),
    ]);
    expect(await collect(p)).toEqual(['half an ans', STREAM_RESET_MARK, 'whole answer']);
  });

  it('does not hide a bad key behind the backup', async () => {
    const p = withBackups([
      fake('gemini', async function* () {
        throw new ProviderError('bad key', false);
      }),
      fake('groq', async function* () {
        yield 'never';
      }),
    ]);
    await expect(collect(p)).rejects.toThrow('bad key');
  });

  it('reports the last error when every provider fails', async () => {
    const p = withBackups([
      fake('gemini', async function* () {
        throw new ProviderError('gemini quota', true);
      }),
      fake('groq', async function* () {
        throw new ProviderError('groq quota', true);
      }),
    ]);
    await expect(collect(p)).rejects.toThrow('groq quota');
  });
});
