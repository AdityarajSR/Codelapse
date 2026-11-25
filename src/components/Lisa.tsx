import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { parseIntent, type PlaybackAction } from '../assistant/intent';
import { Markdown } from '../assistant/Markdown';
import { LIMITS } from '../assistant/protocol';
import { speak, useMuted, useSpeaking } from '../assistant/speech';
import { useAssistant } from '../assistant/store';
import { usePlayback } from '../state/playbackStore';
import type { Language } from '../types/trace';
import { MicButton } from './MicButton';
import { MuteButton } from './MuteButton';
import { Thinking } from './Thinking';
import './Lisa.css';

interface LisaProps {
  code: string;
  language: Language;
  /** put generated code in the editor (switching language if needed) and run it */
  onUseCode: (code: string, language: Language) => void;
  onRun: () => void;
  /** bring the assistant panel into view (switches the phone view) */
  onShowAssistant: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'writing'; request: string }
  | {
      kind: 'wrote';
      request: string;
      explanation: string;
      undo: { code: string; language: Language };
    }
  | { kind: 'done'; text: string }
  | { kind: 'error'; text: string };

const SUGGESTIONS = [
  'Write a binary search',
  'Explain this code',
  'Write bubble sort in JavaScript',
  'Find bugs in my code',
  'Start the tutorial',
];

const CONTROL_LABEL: Record<PlaybackAction, string> = {
  run: 'Running your code.',
  play: 'Playing.',
  pause: 'Paused.',
  next: 'Next step.',
  back: 'Went back one step.',
  start: 'Back to the first step.',
  end: 'Jumped to the last step.',
};

/**
 * Lisa — the assistant in the top bar. Type or speak: she writes programs into
 * the editor and runs them, answers questions about the code (in the
 * assistant panel), starts the tutorial, and steps the playback by voice.
 */
export function Lisa({ code, language, onUseCode, onRun, onShowAssistant }: LisaProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const speakAnswers = useAssistant((s) => s.speakAnswers);
  const setSpeakAnswers = useAssistant((s) => s.setSpeakAnswers);
  const speaking = useSpeaking();
  const muted = useMuted();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Ctrl/⌘ + K opens Lisa from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const say = useCallback(
    (text: string, voice: boolean) => {
      if (voice || speakAnswers) speak(text);
    },
    [speakAnswers],
  );

  const control = (action: PlaybackAction) => {
    const p = usePlayback.getState();
    if (action === 'run') onRun();
    else if (action === 'play') p.play();
    else if (action === 'pause') p.pause();
    else if (action === 'next') p.stepForward();
    else if (action === 'back') p.stepBack();
    else if (action === 'start') p.seek(0);
    else if (action === 'end') p.seek(Number.MAX_SAFE_INTEGER);
  };

  // Shared with the chat box (assistant store): writes, fills the editor,
  // runs it, explains it in the chat, and speaks if asked by voice.
  const write = async (request: string, target: Language, voice: boolean) => {
    const undo = { code, language };
    setStatus({ kind: 'writing', request });
    const result = await useAssistant.getState().write(request, target, { speakAnswer: voice });
    if (result.ok) setStatus({ kind: 'wrote', request, explanation: result.explanation, undo });
    else if (result.aborted) setStatus({ kind: 'idle' });
    else setStatus({ kind: 'error', text: result.error });
  };

  const handle = (raw: string, voice = false) => {
    const intent = parseIntent(raw);
    setInput('');
    switch (intent.kind) {
      case 'empty':
        return;
      case 'control':
        control(intent.action);
        setStatus({ kind: 'done', text: CONTROL_LABEL[intent.action] });
        say(CONTROL_LABEL[intent.action], voice);
        return;
      case 'tutorial':
        setOpen(false);
        setStatus({ kind: 'idle' });
        window.dispatchEvent(new Event('codelapse:tour'));
        return;
      case 'generate':
        void write(intent.request, intent.language ?? language, voice);
        return;
      case 'ask': {
        const { ask, reveal } = useAssistant.getState();
        reveal('ask');
        onShowAssistant();
        void ask(intent.mode, intent.text, { code, language, speakAnswer: voice });
        setStatus({ kind: 'done', text: 'Answering in the Assistant panel…' });
        setOpen(false);
        return;
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (status.kind === 'writing') return;
    handle(input);
  };

  const busy = status.kind === 'writing';

  return (
    <div className="lisa" ref={rootRef}>
      <button
        type="button"
        className={`lisa__trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Ask Lisa (Ctrl+K)"
      >
        <span className="lisa__avatar" aria-hidden="true">
          L
        </span>
        <span className="lisa__name">Ask Lisa</span>
        {speaking && <span className="lisa__wave" aria-label="speaking" />}
      </button>

      {open && (
        <div className="lisa__panel" role="dialog" aria-label="Lisa, your coding assistant">
          <div className="lisa__head">
            <span className="lisa__avatar lisa__avatar--lg" aria-hidden="true">
              L
            </span>
            <div className="lisa__intro">
              <strong>Hi, I'm Lisa</strong>
              <span>Ask about your code, or tell me what to write.</span>
            </div>
            <MuteButton />
          </div>

          <form className="lisa__form" onSubmit={submit}>
            <input
              ref={inputRef}
              className="lisa__input"
              value={input}
              maxLength={LIMITS.question}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try "write a binary search" or "next step"'
              aria-label="Ask Lisa"
              disabled={busy}
            />
            <MicButton
              onText={(t) => handle(t, true)}
              onInterim={setInput}
              disabled={busy}
              className="lisa__mic"
            />
            <button type="submit" className="btn btn--run btn--sm" disabled={busy || !input.trim()}>
              Go
            </button>
          </form>

          {status.kind === 'idle' && (
            <div className="lisa__chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => handle(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {status.kind === 'writing' && (
            <div className="lisa__status" role="status">
              <Thinking kind="write" />
              <button type="button" className="chip" onClick={() => useAssistant.getState().stop()}>
                Cancel
              </button>
            </div>
          )}
          {status.kind === 'wrote' && (
            <div className="lisa__status lisa__status--ok lisa__status--wrote" role="status">
              <div className="lisa__statusTop">
                <span>
                  ✓ Wrote <b>{status.request}</b> into the editor and ran it. Press ▶ to watch.
                </span>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    onUseCode(status.undo.code, status.undo.language);
                    setStatus({ kind: 'done', text: 'Restored your previous code.' });
                  }}
                >
                  Undo
                </button>
              </div>
              {status.explanation && (
                <div className="lisa__explain">
                  <Markdown text={status.explanation} />
                </div>
              )}
            </div>
          )}
          {status.kind === 'done' && (
            <div className="lisa__status" role="status">
              <span>{status.text}</span>
              <button type="button" className="chip" onClick={() => setStatus({ kind: 'idle' })}>
                More ideas
              </button>
            </div>
          )}
          {status.kind === 'error' && (
            <div className="lisa__status lisa__status--err" role="alert">
              <span>{status.text}</span>
              <button type="button" className="chip" onClick={() => setStatus({ kind: 'idle' })}>
                OK
              </button>
            </div>
          )}

          <label className={`lisa__opt${muted ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={speakAnswers && !muted}
              disabled={muted}
              onChange={(e) => setSpeakAnswers(e.target.checked)}
            />
            {muted
              ? 'Lisa is muted — tap the speaker to unmute'
              : 'Also read typed answers aloud (spoken questions always get a spoken reply)'}
          </label>

          <p className="lisa__foot">
            Voice: “next step”, “play”, “run it”, “start the tutorial”. Ctrl+K opens Lisa · Esc
            stops speaking.
          </p>
        </div>
      )}
    </div>
  );
}
