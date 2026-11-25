// @vitest-environment node
// Server code — the provider SDKs refuse to construct in a browser-like env.
import { describe, expect, it } from 'vitest';
import { handleAssistant } from '../../server/assistant';
import { DEFAULT_MODELS, selectProvider } from '../../server/providers';

describe('selectProvider', () => {
  it('returns null when no key is configured', () => {
    expect(selectProvider({})).toBeNull();
    expect(selectProvider({ GEMINI_API_KEY: '   ' })).toBeNull();
  });

  it('prefers the free Gemini key, with its default model', () => {
    const p = selectProvider({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', ANTHROPIC_API_KEY: 'a' });
    expect(p?.id).toBe('gemini');
    expect(p?.model).toBe(DEFAULT_MODELS.gemini);
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
