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
import { LIMITS, type AssistantMode, type ChatTurn } from './protocol';
import { presetQuestion } from './prompt';
import { speak } from './speech';

export type AssistantTab = 'step' | 'ask' | 'quiz';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: string;
}

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
  /** record a finished exchange (e.g. Lisa wrote code) so follow-ups have context */
  addExchange: (question: string, answer: string) => void;
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
      if (own.signal.aborted) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === botId
              ? { ...m, pending: false, content: m.content ? `${m.content}\n\n_(stopped)_` : '' }
              : m,
          ),
        }));
      } else {
        patch({
          pending: false,
          error: err instanceof AssistantError ? err.message : 'Something went wrong.',
        });
      }
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

  stop: () => controller?.abort(),
  clear: () => {
    controller?.abort();
    set({ messages: [] });
  },
}));
