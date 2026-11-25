import { describe, expect, it } from 'vitest';
import { extractCode, extractExplanation, parseIntent } from './intent';
import { buildPrompt, GENERATE_SYSTEM_PROMPT, SYSTEM_PROMPT } from './prompt';
import { parseAssistantRequest } from './protocol';
import { isMuted, lisaVoice, setMuted, speak, speechChunks, toSpeakable } from './speech';

describe('parseIntent', () => {
  it.each([
    ['Write a binary search', 'binary search', null],
    ['write binary search.', 'binary search', null],
    ['Can you write a program for bubble sort in JavaScript?', 'bubble sort', 'javascript'],
    ['code for fibonacci using python', 'fibonacci', 'python'],
    ['make a function that reverses a list', 'reverses a list', null],
    ['Lisa, create a stack example in js', 'stack example', 'javascript'],
    ['binary search ka code likho', 'binary search', null],
  ])('"%s" → write code', (text, request, language) => {
    expect(parseIntent(text)).toEqual({ kind: 'generate', request, language });
  });

  it.each([
    ['next step', 'next'],
    ['Next.', 'next'],
    ['go back', 'back'],
    ['play', 'play'],
    ['pause', 'pause'],
    ['run it', 'run'],
    ['start over', 'start'],
    ['go to the end', 'end'],
  ])('"%s" → playback %s', (text, action) => {
    expect(parseIntent(text)).toEqual({ kind: 'control', action });
  });

  it('recognises the tutorial', () => {
    expect(parseIntent('Start the tutorial').kind).toBe('tutorial');
    expect(parseIntent('how do I use this?').kind).toBe('tutorial');
  });

  it.each([
    ['Explain this code', 'ask'],
    ['What does this code do?', 'ask'],
    ['Find bugs in my code', 'debug'],
    ['what is the time complexity', 'complexity'],
    ['explain line by line', 'line-by-line'],
    ['give me a quiz', 'practice'],
    ['explain the current step', 'step'],
    ['show me the bug', 'debug'],
  ])('"%s" → ask (%s)', (text, mode) => {
    const intent = parseIntent(text);
    expect(intent.kind).toBe('ask');
    if (intent.kind === 'ask') expect(intent.mode).toBe(mode);
  });

  it('ignores empty input', () => {
    expect(parseIntent('   ').kind).toBe('empty');
  });
});

describe('extractExplanation', () => {
  it('returns the text after the code block', () => {
    expect(extractExplanation('```py\nx = 1\n```\n\nIt sets **x**.\n- one')).toBe(
      'It sets **x**.\n- one',
    );
  });
  it('is empty without a code block', () => {
    expect(extractExplanation('print(1)')).toBe('');
  });
});

describe('extractCode', () => {
  it('takes the first fenced block', () => {
    expect(extractCode('Sure!\n```python\nprint(1)\n```\nDone')).toBe('print(1)\n');
  });
  it('falls back to the whole reply', () => {
    expect(extractCode('print(2)')).toBe('print(2)\n');
  });
  it('returns empty for an empty reply', () => {
    expect(extractCode('  ')).toBe('');
  });
});

describe('generate mode', () => {
  const context = {
    language: 'javascript' as const,
    code: '',
    status: null,
    totalSteps: 0,
    diagnostics: [],
    step: null,
    recentLines: [],
  };

  it('requires a request', () => {
    expect(parseAssistantRequest({ mode: 'generate', question: '', history: [], context }).ok).toBe(
      false,
    );
    expect(
      parseAssistantRequest({ mode: 'generate', question: 'binary search', history: [], context })
        .ok,
    ).toBe(true);
  });

  it('uses the code-writing prompt and names the language', () => {
    const { system, messages } = buildPrompt({
      mode: 'generate',
      question: 'binary search',
      history: [{ role: 'user', content: 'old chat' }],
      context,
    });
    expect(system).toBe(GENERATE_SYSTEM_PROMPT);
    expect(messages).toHaveLength(1); // chat history is not sent
    expect(messages[0].content).toMatch(/Language: JavaScript/);
    expect(messages[0].content).toMatch(/binary search/);
  });
});

describe('toSpeakable', () => {
  it('strips Markdown and ends every line as a sentence (natural pauses)', () => {
    expect(
      toSpeakable(
        '- **Line 1:** sets `total` to `0`\n- adds `i`\n```py\nx=1\n```\n### Done → next',
      ),
    ).toBe('Line 1: sets total to 0. adds i. The code is on your screen. Done to next.');
  });
});

describe('speechChunks', () => {
  it('splits long text at sentence ends', () => {
    const text = 'One sentence here. '.repeat(30).trim();
    const chunks = speechChunks(text, 100);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.length <= 100 && c.endsWith('.'))).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });
});

describe('lisaVoice', () => {
  const v = (name: string, lang = 'en-US') => ({ name, lang }) as SpeechSynthesisVoice;
  it('prefers an Indian-English female natural voice', () => {
    const voices = [
      v('Microsoft David - English (United States)'),
      v('Microsoft Zira - English (United States)'),
      v('Microsoft Neerja Online (Natural) - English (India)', 'en-IN'),
      v('Microsoft Ravi - English (India)', 'en-IN'),
    ];
    expect(lisaVoice(voices)?.name).toMatch(/Neerja/);
  });
  it('picks a natural voice over an old offline one', () => {
    expect(
      lisaVoice([
        v('Microsoft Heera - English (India)', 'en-IN'),
        v('Microsoft Aria Online (Natural) - English (United States)'),
      ])?.name,
    ).toMatch(/Aria/);
    expect(lisaVoice([v('Microsoft Zira'), v('Google UK English Female', 'en-GB')])?.name).toMatch(
      /Google UK English Female/,
    );
  });
  it('falls back to another female voice, never a non-English one', () => {
    expect(lisaVoice([v('Microsoft David'), v('Microsoft Zira'), v('Hema', 'hi-IN')])?.name).toBe(
      'Microsoft Zira',
    );
    expect(lisaVoice([v('Hema', 'hi-IN')])).toBeNull();
  });
});

describe('mute', () => {
  it('blocks automatic speech, allows manual, and stops speech when muted', () => {
    const spoken: string[] = [];
    let cancels = 0;
    const synth = {
      cancel: () => {
        cancels++;
      },
      getVoices: () => [],
      speak: (u: { text: string }) => spoken.push(u.text),
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    class Utterance {
      text: string;
      constructor(t: string) {
        this.text = t;
      }
    }
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      Utterance;

    setMuted(false);
    speak('Hello there.');
    expect(spoken).toEqual(['Hello there.']);

    const before = cancels;
    setMuted(true);
    expect(cancels).toBeGreaterThan(before); // stopped mid-sentence
    expect(isMuted()).toBe(true);
    speak('Automatic answer.');
    expect(spoken).toHaveLength(1); // blocked
    speak('Tapped speaker.', { manual: true });
    expect(spoken).toEqual(['Hello there.', 'Tapped speaker.']);

    setMuted(false);
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  });
});

describe('shorter code requests', () => {
  it.each([
    ['binary search code', 'binary search', null],
    ['bubble sort program in javascript', 'bubble sort', 'javascript'],
    ['program for fibonacci', 'fibonacci', null],
    ['code of linear search', 'linear search', null],
  ])('"%s" → write code', (text, request, language) => {
    expect(parseIntent(text)).toEqual({ kind: 'generate', request, language });
  });
  it.each(['explain this code', 'fix my code', 'what does my program do'])(
    '"%s" stays a question',
    (text) => {
      expect(parseIntent(text).kind).toBe('ask');
    },
  );
});

describe('English only', () => {
  it('tells the model to always answer in English', () => {
    expect(SYSTEM_PROMPT).toMatch(/Always reply in clear, simple English/);
    expect(SYSTEM_PROMPT).not.toMatch(/Hinglish\)\. Preset/);
  });
});
