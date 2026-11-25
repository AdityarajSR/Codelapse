/**
 * Understands what the student asked Lisa (typed or spoken) — locally, with
 * no AI call — and routes it: write code, ask the tutor, start the tutorial,
 * or a playback command ("next step", "play").
 */
import type { Language } from '../types/trace';
import type { AssistantMode } from './protocol';

export type PlaybackAction = 'run' | 'play' | 'pause' | 'next' | 'back' | 'start' | 'end';

export type Intent =
  | { kind: 'generate'; request: string; language: Language | null }
  | { kind: 'ask'; mode: AssistantMode; text: string }
  | { kind: 'tutorial' }
  | { kind: 'control'; action: PlaybackAction }
  | { kind: 'empty' };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.!?,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const CONTROLS: [RegExp, PlaybackAction][] = [
  [/^(run|run it|run (the|my)? ?code|execute( it)?|chalao|run karo)$/, 'run'],
  [/^(play|start playing|resume|continue|chalu karo)$/, 'play'],
  [/^(pause|stop|hold on|wait|ruko)$/, 'pause'],
  [/^(next|next step|step|step forward|forward|aage|agla)$/, 'next'],
  [/^(back|previous|previous step|step back|go back|peeche|pichla)$/, 'back'],
  [/^(restart|start over|go to (the )?(start|beginning)|first step|reset)$/, 'start'],
  [/^(end|go to (the )?end|last step|skip to (the )?end)$/, 'end'],
];

/** "write a binary search", "code for bubble sort in javascript", "make a program that…" */
const GENERATE =
  /^(?:(?:can you|could you|please|pls|lisa,?)\s+)*(?:write|create|generate|make|build|give me|show me|code|implement)\b(?:\s+(?:me|us))?(?:\s+(?:a|an|the|some))?(?:\s+(?:program|code|function|script|example))?(?:\s+(?:for|of|to|that|which))?\s+(.+)$/;
const GENERATE_HINGLISH =
  /^(.+?)\s+(?:ka|ki|ke)\s+(?:code|program)\s+(?:likho|likh do|bana do|banao|do)$/;
/** "binary search code", "bubble sort program in javascript" */
const GENERATE_NOUN_LAST =
  /^(.+?)\s+(?:code|program|example|implementation|algorithm)((?:\s+(?:in|using)\s+\w+)?)$/;
/** "program for fibonacci", "code of binary search" */
const GENERATE_NOUN_FIRST =
  /^(?:a\s+)?(?:program|code|example|implementation)\s+(?:for|of|to|that)\s+(.+)$/;

function languageIn(text: string): { language: Language | null; rest: string } {
  const m = /\s*\b(?:in|using|with)\s+(python|py|javascript|js|node)\b\s*/.exec(text);
  if (!m) return { language: null, rest: text };
  const language: Language = m[1].startsWith('p') ? 'python' : 'javascript';
  return {
    language,
    rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim(),
  };
}

export function parseIntent(raw: string): Intent {
  const text = norm(raw);
  if (!text) return { kind: 'empty' };

  for (const [re, action] of CONTROLS) if (re.test(text)) return { kind: 'control', action };

  if (
    /\b(tutorial|tour|show me around|how (do i|to) use (this|codelapse|the app)|guide me)\b/.test(
      text,
    )
  ) {
    return { kind: 'tutorial' };
  }

  // Strong "write code" verbs win; then learning keywords (bug, quiz, …) about
  // the CURRENT code; only then the weaker verbs ("give me", "show me", "make").
  // Questions ("what/why/how/explain …") are never code requests.
  const isQuestion = /^(?:what|why|how|explain)\b/.test(text);
  const strongVerb =
    /^(?:(?:can you|could you|please|pls|lisa,?)\s+)*(?:write|create|generate|implement|code|build)\b/.test(
      text,
    );
  const generate = (): Intent | null => {
    if (isQuestion) return null;
    const nounLast = GENERATE_NOUN_LAST.exec(text);
    const topic =
      GENERATE.exec(text)?.[1] ??
      GENERATE_HINGLISH.exec(text)?.[1] ??
      GENERATE_NOUN_FIRST.exec(text)?.[1] ??
      (nounLast ? nounLast[1] + nounLast[2] : null);
    // "my code", "this program" are about the CURRENT code, not a request
    if (!topic || /\b(this|my|the above|current)\b/.test(topic)) return null;
    const { language, rest } = languageIn(topic);
    const request = rest.replace(/^(?:a|an|the)\s+/, '').trim();
    if (!request || /^(this|my|the)( code| program)?$/.test(request)) return null;
    return { kind: 'generate', request, language };
  };

  if (strongVerb) {
    const g = generate();
    if (g) return g;
  }

  const askAs = (mode: AssistantMode): Intent => ({ kind: 'ask', mode, text: raw.trim() });
  if (/\b(bug|bugs|error|errors|wrong|fix|debug|not working|galat)\b/.test(text)) {
    return askAs('debug');
  }
  if (/\b(complexity|big ?o|optimi[sz]e|faster)\b/.test(text)) return askAs('complexity');
  if (/\bline by line\b/.test(text)) return askAs('line-by-line');
  if (/\b(quiz|practice|test me|exercise)\b/.test(text)) return askAs('practice');
  if (/\b(this step|current step|current line|what just happened)\b/.test(text)) {
    return askAs('step');
  }

  return generate() ?? askAs('ask');
}

/** The explanation the model wrote after the program (empty if none). */
export function extractExplanation(reply: string): string {
  const fenced = /```[\w+-]*[ \t]*\n[\s\S]*?```/.exec(reply);
  return fenced ? reply.slice(fenced.index + fenced[0].length).trim() : '';
}

/** Pull the program out of a model reply (first fenced block, else the whole text). */
export function extractCode(reply: string): string {
  const fenced = /```[\w+-]*[ \t]*\n([\s\S]*?)```/.exec(reply);
  const code = (fenced ? fenced[1] : reply).replace(/\s+$/, '');
  return code.trim() ? code + '\n' : '';
}
