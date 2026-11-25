import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Inline, Markdown } from '../assistant/Markdown';
import { narrateStep, type PointKind } from '../assistant/narrate';
import { LIMITS, type AssistantMode } from '../assistant/protocol';
import { buildQuiz } from '../assistant/quiz';
import { canSpeak, speak, stopSpeaking, useSpeaking } from '../assistant/speech';
import { useAssistant, type ChatMessage } from '../assistant/store';
import { useCollapsed } from '../hooks/useCollapsed';
import { usePlayback } from '../state/playbackStore';
import type { Language } from '../types/trace';
import { ChevronIcon, CollapseButton } from './Collapsible';
import { MicButton, SpeakerIcon } from './MicButton';
import './AssistantPanel.css';

interface AssistantPanelProps {
  code: string;
  language: Language;
}

const TABS = [
  ['step', 'This step'],
  ['ask', 'Ask AI'],
  ['quiz', 'Quiz'],
] as const;

/**
 * The AI assistant: instant step explanations (no AI), an AI chat with preset
 * questions, and prediction quizzes checked against the real run. Chat state
 * lives in the shared assistant store, so Lisa (header) can ask too.
 */
export function AssistantPanel({ code, language }: AssistantPanelProps) {
  const tab = useAssistant((s) => s.tab);
  const setTab = useAssistant((s) => s.setTab);
  const busy = useAssistant((s) => s.busy);
  const revealSeq = useAssistant((s) => s.revealSeq);
  const [collapsed, toggleCollapsed] = useCollapsed('assistant');

  // Latest code/language without re-creating `ask` on every keystroke.
  const codeRef = useRef(code);
  const langRef = useRef(language);
  codeRef.current = code;
  langRef.current = language;

  const ask = useCallback(
    (mode: AssistantMode, typed = '', speakAnswer = false) =>
      void useAssistant
        .getState()
        .ask(mode, typed, { code: codeRef.current, language: langRef.current, speakAnswer }),
    [],
  );

  // Someone (Lisa) asked us to show ourselves: expand if collapsed.
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  useEffect(() => {
    if (revealSeq > 0 && collapsedRef.current) toggleCollapsed();
  }, [revealSeq, toggleCollapsed]);

  const askFromStep = useCallback(
    (mode: AssistantMode) => {
      setTab('ask');
      ask(mode);
    },
    [ask, setTab],
  );

  return (
    <section
      className={`card assistant assistant--${tab}${collapsed ? ' assistant--collapsed' : ''}`}
      aria-label="AI assistant"
    >
      <div className="assistant__head">
        <span className="assistant__title">
          <SparkIcon />
          Assistant
        </span>
        <div className="assistant__tabs" role="tablist" aria-label="Assistant views">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              id={`assistant-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`assistant-pane-${id}`}
              className={`assistant__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => {
                setTab(id);
                if (collapsed) toggleCollapsed();
              }}
            >
              {label}
              {id === 'ask' && busy && <span className="assistant__busyDot" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <CollapseButton
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          controls={`assistant-pane-${tab}`}
          label="assistant"
        />
      </div>

      {/* Collapsing hides the body with CSS (wide screens only) — on phones
          the assistant has its own view and is always open. */}
      <div
        className="assistant__body"
        role="tabpanel"
        id={`assistant-pane-${tab}`}
        aria-labelledby={`assistant-tab-${tab}`}
      >
        {tab === 'step' && <StepTab code={code} onAsk={askFromStep} />}
        {tab === 'ask' && <ChatTab onAsk={ask} />}
        {tab === 'quiz' && <QuizTab code={code} />}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- read aloud -- */

/** Speaker toggle: reads `text` aloud, or stops if already speaking. */
function ReadAloud({ text, label = 'Read aloud' }: { text: string; label?: string }) {
  const speaking = useSpeaking();
  const [mine, setMine] = useState(false);
  useEffect(() => {
    if (!speaking) setMine(false);
  }, [speaking]);
  if (!canSpeak() || !text) return null;
  const active = speaking && mine;
  return (
    <button
      type="button"
      className={`readAloud${active ? ' is-on' : ''}`}
      onClick={() => {
        if (active) {
          stopSpeaking();
        } else {
          speak(text, { manual: true });
          setMine(true);
        }
      }}
      aria-pressed={active}
      aria-label={active ? 'Stop reading' : label}
      title={active ? 'Stop reading' : label}
    >
      <SpeakerIcon off={active} />
    </button>
  );
}

/* ------------------------------------------------------------ This step -- */

const KIND_LABEL: Record<PointKind, string> = {
  line: 'Next line',
  change: 'Changed',
  flow: 'Flow',
  stack: 'Call stack',
  output: 'Output',
  error: 'Error',
  done: 'Done',
};

/** The only assistant view subscribed to the playback index. */
function StepTab({ code, onAsk }: { code: string; onAsk: (mode: AssistantMode) => void }) {
  const trace = usePlayback((s) => s.trace);
  const index = usePlayback((s) => s.index);
  const narration = useMemo(() => narrateStep(trace, index, code), [trace, index, code]);
  const hasError =
    !!trace && (trace.status === 'runtime-error' || trace.status === 'compile-error');
  const spoken = [narration.headline, ...narration.points.map((p) => p.text)].join('\n');

  return (
    <div className="stepx">
      <p className="stepx__headline" aria-live="polite">
        {trace && trace.steps.length > 0 && (
          <span className="stepx__count">
            Step {Math.min(index, trace.steps.length - 1) + 1}/{trace.steps.length}
          </span>
        )}
        <Inline text={narration.headline} />
        <ReadAloud text={spoken} label="Read this step aloud" />
      </p>
      {narration.points.length > 0 && (
        <ul className="stepx__points">
          {narration.points.map((p, i) => (
            <li key={i} className={`stepx__point stepx__point--${p.kind}`}>
              <span className="stepx__kind">{KIND_LABEL[p.kind]}</span>
              <span>
                <Inline text={p.text} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="stepx__actions">
        <button className="chip chip--ai" onClick={() => onAsk('step')} disabled={!trace}>
          <SparkIcon /> Explain this step with AI
        </button>
        {hasError && (
          <button className="chip chip--ai" onClick={() => onAsk('debug')}>
            <SparkIcon /> Help me fix this error
          </button>
        )}
        <span className="stepx__note">Instant explanation from your run — no AI needed.</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Chat -- */

const PRESETS: { mode: AssistantMode; label: string }[] = [
  { mode: 'explain', label: 'What does this code do?' },
  { mode: 'line-by-line', label: 'Explain line by line' },
  { mode: 'step', label: 'Explain this step' },
  { mode: 'debug', label: 'Find bugs & errors' },
  { mode: 'complexity', label: 'Time & space complexity' },
  { mode: 'practice', label: 'Quiz & practice questions' },
];

function ChatTab({
  onAsk,
}: {
  onAsk: (mode: AssistantMode, typed?: string, speakAnswer?: boolean) => void;
}) {
  const messages = useAssistant((s) => s.messages);
  const busy = useAssistant((s) => s.busy);
  const stop = useAssistant((s) => s.stop);
  const clear = useAssistant((s) => s.clear);
  const [input, setInput] = useState('');
  const [presetsOpen, setPresetsOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Grow the box with its text (1 → ~5 lines), then scroll inside it.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const send = (text: string, spoken = false) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    onAsk('ask', q, spoken);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const pick = (mode: AssistantMode) => {
    setPresetsOpen(false);
    onAsk(mode);
  };

  const presetButtons = (
    <div className="chat__presets" id="chat-presets">
      {PRESETS.map((p) => (
        <button key={p.mode} className="chip" disabled={busy} onClick={() => pick(p.mode)}>
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="chat">
      {started && (
        <div className="chat__toolbar">
          <button
            type="button"
            className="chip"
            aria-expanded={presetsOpen}
            aria-controls="chat-presets"
            onClick={() => setPresetsOpen((o) => !o)}
          >
            Quick questions
            <ChevronIcon open={presetsOpen} />
          </button>
          {!busy && (
            <button type="button" className="chip chat__clear" onClick={clear}>
              Clear chat
            </button>
          )}
        </div>
      )}
      {started && presetsOpen && presetButtons}

      <div className="chat__log" ref={logRef} aria-live="polite">
        {started ? (
          <MessageList messages={messages} />
        ) : (
          <div className="chat__welcome">
            <p className="empty">
              Ask anything about your code — “Why do we use this loop?”, “What is the purpose of{' '}
              <code>total</code>?” — or pick one:
            </p>
            {presetButtons}
            <p className="chat__hint">
              Answers use the line and values you are paused on. Tap the mic to speak.
            </p>
          </div>
        )}
      </div>

      <form className="chat__form" onSubmit={submit}>
        <div className="chat__inputRow">
          <textarea
            ref={inputRef}
            className="chat__input"
            value={input}
            maxLength={LIMITS.question}
            rows={1}
            placeholder="Ask about this code…"
            aria-label="Your question"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
          />
          <MicButton onText={(t) => send(t, true)} onInterim={setInput} disabled={busy} />
          {busy ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={stop}>
              Stop
            </button>
          ) : (
            <button type="submit" className="btn btn--run btn--sm" disabled={!input.trim()}>
              Ask
            </button>
          )}
        </div>
        <p className="chat__privacy">
          Enter to send · Shift+Enter for a new line · sent to Google Gemini to answer
        </p>
      </form>
    </div>
  );
}

const MessageList = memo(function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <ol className="chat__messages">
      {messages.map((m) => (
        <li key={m.id} className={`msg msg--${m.role}`}>
          {m.role === 'user' ? (
            <p className="msg__user">{m.content}</p>
          ) : (
            <>
              {m.content && <Markdown text={m.content} />}
              {m.pending && !m.content && (
                <p className="msg__thinking">
                  <span className="spinner spinner--light" aria-hidden="true" /> Thinking…
                </p>
              )}
              {m.error && (
                <p className="msg__error" role="alert">
                  {m.error}
                </p>
              )}
              {!m.pending && m.content && (
                <div className="msg__tools">
                  <ReadAloud text={m.content} label="Read this answer aloud" />
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ol>
  );
});

/* ---------------------------------------------------------------- Quiz -- */

function QuizTab({ code }: { code: string }) {
  const trace = usePlayback((s) => s.trace);
  const seek = usePlayback((s) => s.seek);
  const pause = usePlayback((s) => s.pause);

  // The question is anchored to where the student was when it was made — it
  // must not change while they scrub around to check their answer.
  const [anchor, setAnchor] = useState(() => usePlayback.getState().index);
  const [variant, setVariant] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const question = useMemo(
    () => buildQuiz(trace, anchor, code, variant),
    [trace, anchor, code, variant],
  );

  // New trace → start over from the current position.
  const traceRef = useRef(trace);
  useEffect(() => {
    if (traceRef.current !== trace) {
      traceRef.current = trace;
      setAnchor(usePlayback.getState().index);
      setPicked(null);
    }
  }, [trace]);

  // Put the student on the step the question is about.
  useEffect(() => {
    if (question) {
      pause();
      seek(question.askStep);
    }
  }, [question, seek, pause]);

  if (!trace || trace.steps.length < 2) {
    return <p className="empty">Run your code to get quiz questions about it.</p>;
  }
  if (!question) {
    return (
      <div className="quiz">
        <p className="empty">No more questions after this point in the run.</p>
        <button
          className="chip"
          onClick={() => {
            setAnchor(0);
            setPicked(null);
          }}
        >
          Start again from the beginning
        </button>
      </div>
    );
  }

  const answered = picked !== null;
  const correct = picked === question.answer;

  const choose = (opt: string) => {
    if (answered) return;
    setPicked(opt);
    setScore((s) => ({ right: s.right + (opt === question.answer ? 1 : 0), total: s.total + 1 }));
  };

  const next = () => {
    setAnchor(question.revealStep);
    setVariant((v) => v + 1);
    setPicked(null);
  };

  return (
    <div className="quiz">
      <div className="quiz__top">
        <span className="quiz__kind">
          {question.kind === 'value' ? 'Predict the value' : 'Predict the next line'}
        </span>
        {score.total > 0 && (
          <span className="quiz__score">
            Score {score.right}/{score.total}
          </span>
        )}
      </div>
      <p className="quiz__prompt">
        <Inline text={question.prompt} />
      </p>
      {question.lineCode && (
        <pre className="quiz__code">
          <span className="quiz__ln">{question.line}</span>
          {question.lineCode}
        </pre>
      )}
      <div className="quiz__options" role="group" aria-label="Answers">
        {question.options.map((opt) => {
          const state = !answered
            ? ''
            : opt === question.answer
              ? ' is-right'
              : opt === picked
                ? ' is-wrong'
                : ' is-dim';
          return (
            <button
              key={opt}
              className={`quiz__opt${state}`}
              onClick={() => choose(opt)}
              disabled={answered}
            >
              <code>{opt}</code>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz__result${correct ? ' is-right' : ' is-wrong'}`} role="status">
          <strong>{correct ? 'Correct!' : 'Not quite.'}</strong>{' '}
          <Inline text={question.explanation} />
          <div className="quiz__actions">
            <button className="chip" onClick={() => seek(question.revealStep)}>
              Show me in the run
            </button>
            <button className="btn btn--run btn--sm" onClick={next}>
              Next question
            </button>
          </div>
        </div>
      )}
      {!answered && (
        <p className="quiz__hint">
          Hint: look at the Variables panel — it shows the values right before this line runs.
        </p>
      )}
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" className="spark">
      <path
        fill="currentColor"
        d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"
      />
    </svg>
  );
}
