/**
 * Shared assistant state: the chat, the active tab, and voice settings. The
 * assistant panel and Lisa (the header assistant) both read and write it, so a
 * question asked from either place lands in the same conversation.
 */
import { create } from 'zustand';
import { usePlayback } from '../state/playbackStore';
import type { Language } from '../types/trace';
import { AssistantError, streamAssistant } from './client';
import { buildAssistantContext } from './context';
import { extractCode, extractExplanation } from './intent';
import { LIMITS, type AssistantMode, type ChatTurn } from './protocol';
import { presetQuestion } from './prompt';
import { speak } from './speech';

export type AssistantTab = 'step' | 'ask' | 'quiz';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  /** 'write' = Lisa / the chat is writing a program (different loading words) */
  kind?: 'write';
  error?: string;
  /** failed or stopped — show a Retry button */
  canRetry?: boolean;
}

export type CodeSink = (code: string, language: Language) => void;

export type WriteResult =
  { ok: true; explanation: string } | { ok: false; error: string; aborted?: boolean };

export interface AskOptions {
  code: string;
  language: Language;
  /** read the answer aloud when it's done (e.g. the question was spoken) */
  speakAnswer?: boolean;
}

interface AssistantState {
  tab: AssistantTab;
  messages: ChatMessage[];
  busy: boolean;
  /** read every answer aloud */
  speakAnswers: boolean;
  /** bumped to ask the panel to open itself (expand / switch view) */
  revealSeq: number;

  setTab: (tab: AssistantTab) => void;
  setSpeakAnswers: (on: boolean) => void;
  reveal: (tab?: AssistantTab) => void;
  ask: (mode: AssistantMode, typed: string, opts: AskOptions) => Promise<void>;
  /**
   * Write a program for `request`, put it in the editor (via the registered
   * code sink, which also runs it) and explain it in the chat. Used by both
   * Lisa and the chat box, so "write a binary search" works from either.
   */
  write: (
    request: string,
    language: Language,
    opts?: { speakAnswer?: boolean },
  ) => Promise<WriteResult>;
  /** App registers how to put code in the editor and run it */
  setCodeSink: (sink: CodeSink | null) => void;
  /** record a finished exchange (e.g. Lisa wrote code) so follow-ups have context */
  addExchange: (question: string, answer: string) => void;
  /** ask a failed or stopped question again (by its answer's id) */
  retry: (botId: number) => void;
  stop: () => void;
  clear: () => void;
}

const TAB_KEY = 'codelapse.assistant.tab';
const SPEAK_KEY = 'codelapse.assistant.speak';

function readTab(): AssistantTab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t === 'step' || t === 'ask' || t === 'quiz') return t;
  } catch {
    // storage unavailable — default tab
  }
  return 'step';
}
function readSpeak(): boolean {
  try {
    return localStorage.getItem(SPEAK_KEY) === '1';
  } catch {
    return false;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered — fine
  }
}

let controller: AbortController | null = null;
let nextId = 0;
let codeSink: CodeSink | null = null;
/** How to re-ask each failed/stopped answer, by its message id. */
const retryFns = new Map<number, () => Promise<unknown>>();

export const useAssistant = create<AssistantState>((set, get) => ({
  tab: readTab(),
  messages: [],
  busy: false,
  speakAnswers: readSpeak(),
  revealSeq: 0,

  setTab: (tab) => {
    store(TAB_KEY, tab);
    set({ tab });
  },
  setSpeakAnswers: (on) => {
    store(SPEAK_KEY, on ? '1' : '0');
    set({ speakAnswers: on });
  },
  reveal: (tab) => {
    if (tab) get().setTab(tab);
    set((s) => ({ revealSeq: s.revealSeq + 1 }));
  },

  ask: async (mode, typed, opts) => {
    if (controller) return; // one question at a time
    const { trace, index, pause } = usePlayback.getState();
    pause(); // freeze the step the question is about

    const history: ChatTurn[] = get()
      .messages.filter((m) => !m.error && !m.pending && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-LIMITS.historyTurns);
    const context = buildAssistantContext(opts.code, opts.language, trace, index);

    const userId = ++nextId;
    const botId = ++nextId;
    const shown =
      typed ||
      (mode === 'step' && context.step
        ? `Explain step ${context.step.index + 1} (line ${context.step.line}).`
        : presetQuestion(mode));
    set((s) => ({
      busy: true,
      messages: [
        ...s.messages,
        { id: userId, role: 'user', content: shown },
        { id: botId, role: 'assistant', content: '', pending: true },
      ],
    }));

    const own = new AbortController();
    controller = own;
    const patch = (p: Partial<ChatMessage>) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === botId ? { ...m, ...p } : m)) }));

    try {
      const answer = await streamAssistant(
        { mode, question: typed, history, context },
        (soFar) => patch({ content: soFar }),
        own.signal,
      );
      patch({ content: answer, pending: false });
      if (opts.speakAnswer || get().speakAnswers) speak(answer);
    } catch (err) {
      retryFns.set(botId, () => get().ask(mode, typed, opts));
      if (own.signal.aborted) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === botId
              ? {
                  ...m,
                  pending: false,
                  canRetry: true,
                  content: m.content ? `${m.content}\n\n_(stopped)_` : '_(stopped)_',
                }
              : m,
          ),
        }));
      } else {
        patch({
          pending: false,
          canRetry: true,
          error: err instanceof AssistantError ? err.message : 'Something went wrong.',
        });
      }
    } finally {
      if (controller === own) controller = null;
      set({ busy: false });
    }
  },

  setCodeSink: (sink) => {
    codeSink = sink;
  },

  write: async (request, language, opts = {}) => {
    if (controller)
      return { ok: false, error: 'Busy with another answer — try again in a moment.' };
    const userId = ++nextId;
    const botId = ++nextId;
    set((s) => ({
      busy: true,
      messages: [
        ...s.messages,
        { id: userId, role: 'user', content: `Write ${request}` },
        { id: botId, role: 'assistant', content: '', pending: true, kind: 'write' },
      ],
    }));
    const patch = (p: Partial<ChatMessage>) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === botId ? { ...m, ...p } : m)) }));

    const own = new AbortController();
    controller = own;
    try {
      const reply = await streamAssistant(
        {
          mode: 'generate',
          question: request,
          history: [],
          context: buildAssistantContext('', language, null, 0),
        },
        () => {},
        own.signal,
      );
      const program = extractCode(reply);
      if (!program || program.length > LIMITS.code) {
        throw new AssistantError("I couldn't write that one. Try describing it differently.");
      }
      const explanation = extractExplanation(reply);
      codeSink?.(program, language);
      patch({
        pending: false,
        content: `Here's **${request}** — it's in the editor and running. Press ▶ to watch it.\n\n${explanation}`,
      });
      if (opts.speakAnswer || get().speakAnswers) {
        speak(`Here's ${request}. ${explanation} Press play to watch it run.`);
      }
      return { ok: true, explanation };
    } catch (err) {
      const aborted = own.signal.aborted;
      const error = aborted
        ? 'Stopped.'
        : err instanceof AssistantError
          ? err.message
          : 'Something went wrong.';
      retryFns.set(botId, () => get().write(request, language, opts));
      patch({
        pending: false,
        canRetry: true,
        error: aborted ? undefined : error,
        content: aborted ? '_(stopped)_' : '',
      });
      if (!aborted && opts.speakAnswer) speak(error);
      return { ok: false, error, aborted };
    } finally {
      if (controller === own) controller = null;
      set({ busy: false });
    }
  },

  addExchange: (question, answer) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: ++nextId, role: 'user', content: question },
        { id: ++nextId, role: 'assistant', content: answer },
      ],
    })),

  retry: (botId) => {
    const again = retryFns.get(botId);
    if (!again || controller) return;
    retryFns.delete(botId);
    // drop the failed exchange (question + answer), then ask it again
    set((s) => ({ messages: s.messages.filter((m) => m.id !== botId && m.id !== botId - 1) }));
    void again();
  },

  stop: () => controller?.abort(),
  clear: () => {
    controller?.abort();
    retryFns.clear();
    set({ messages: [] });
  },
}));
