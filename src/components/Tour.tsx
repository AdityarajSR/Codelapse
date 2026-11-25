import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { randomFact } from '../lib/facts';
import { sfx } from '../lib/sfx';
import { CloseIcon } from './Icons';

// v2: the tour grew (Lisa, assistant, resizing) — offered once more to
// people who saw the first version.
const KEY = 'codelapse.tour.v2';

interface TourStep {
  /** comma-separated alternatives; the first VISIBLE match is used (phone vs desktop) */
  selector: string;
  title: string;
  body: string;
  /** clicking the control during the tour would open something the spotlight can't show */
  noInteract?: boolean;
}

/** The first matching element that is actually on screen. */
function visible(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

// Steps whose control isn't visible on this screen (phone vs laptop, no
// WebGL…) are skipped automatically.
const ALL_STEPS: TourStep[] = [
  {
    selector: '.langSelect',
    title: 'Pick a language',
    body: 'Python and JavaScript run right in your browser. Java, C and C++ are on the way.',
  },
  {
    selector: '.exampleSelect',
    title: 'Start from an example',
    body: 'Sorting, recursion, stacks, dictionaries — pick one, or paste your own code in the editor.',
  },
  {
    selector: '.lisa__trigger',
    title: 'Meet Lisa',
    body: 'Type or tap the mic: “write a binary search”, “why is total 6?”, “next step”. Ctrl+K opens her anytime.',
    noInteract: true,
  },
  {
    selector: '.header > .muteBtn',
    title: 'Voice on or off',
    body: 'Lisa can read answers aloud. Tap here to mute her — or press Esc to stop her mid-sentence.',
  },
  {
    selector: '.mnav',
    title: 'Three views',
    body: 'Code to edit, Visualize to watch it run, Assistant for explanations and quizzes.',
  },
  {
    selector: '.assistant__tabs',
    title: 'Your assistant',
    body: '“This step” explains every line as it runs, “Ask AI” answers questions, “Quiz” tests your predictions.',
  },
  {
    selector: '.splitter--columns',
    title: 'Make room',
    body: 'Drag the bars between panels to resize them. Section headers collapse with one click.',
  },
  {
    selector: '.stage .toggle',
    title: '3D or 2D',
    body: 'Your lists and dicts appear as 3D objects on the stage — drag to orbit, or flip to flat 2D.',
  },
  {
    selector: '.speed, .speedCycle',
    title: 'Set the pace',
    body: 'Slow down to follow every step, or speed up to 16× for long loops.',
  },
  {
    selector: '.playbar .icon-btn--primary',
    title: 'Press play',
    body: 'Your code becomes a video — play, pause, step with ← →, scrub the timeline. Go!',
  },
];

type Phase = 'welcome' | number | null;

/** Offered automatically on the first few visits per device (browser). The
 * Tutorial button in the top bar replays it anytime. */
const MAX_AUTO_SHOWS = 3;
const SHOWN_KEY = 'codelapse.tour.shown';

function remember(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage blocked — they'll just see it again */
  }
}

// React's dev StrictMode mounts twice — count each page load only once.
let countedThisLoad = false;

/** Should the welcome open by itself on this page load? Counts the show. */
function takeAutoShow(): boolean {
  try {
    if (countedThisLoad) return true;
    const n = Number(localStorage.getItem(SHOWN_KEY)) || 0;
    if (n >= MAX_AUTO_SHOWS) return false;
    localStorage.setItem(SHOWN_KEY, String(n + 1));
    countedThisLoad = true;
    return true;
  } catch {
    return false; // storage blocked — don't show on every load
  }
}

/**
 * First-run flow: a welcome dialog (did-you-know fact + opt-in), then small
 * popovers anchored to the real controls with a glowing ring. Remembered in
 * localStorage — ask once, never nag again. Nothing auto-plays.
 */
export function FirstRunTour() {
  const [phase, setPhase] = useState<Phase>(null);
  const [steps, setSteps] = useState<TourStep[]>(ALL_STEPS);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // When the highlighted control is a dropdown, its open menu pops out below —
  // we track it so the spotlight hole can uncover it (otherwise the scrim,
  // which sits above the glass header, blurs and dims the options).
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  // Chosen once per open — so it differs across browsers/sessions.
  const [fact] = useState(randomFact);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);

  // "You need to finish this first" — clicking outside the card shakes it.
  const bump = () => {
    const el = shakeRef.current;
    if (!el) return;
    el.classList.remove('is-shaking');
    void el.offsetWidth; // reflow so the animation restarts on every click
    el.classList.add('is-shaking');
  };
  const onShakeEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName === 'shake') e.currentTarget.classList.remove('is-shaking');
  };

  useEffect(() => {
    if (takeAutoShow()) setPhase('welcome');
  }, []);

  useEffect(() => {
    if (phase === 'welcome') primaryRef.current?.focus();
  }, [phase]);

  // "Start the tutorial" from Lisa (or anywhere): show the welcome again.
  useEffect(() => {
    const open = () => setPhase('welcome');
    window.addEventListener('codelapse:tour', open);
    return () => window.removeEventListener('codelapse:tour', open);
  }, []);

  const decline = () => {
    remember('declined');
    setPhase(null);
  };
  const skip = () => {
    remember('skipped');
    setPhase(null);
  };
  const finish = () => {
    remember('done');
    sfx('done');
    setPhase(null);
  };
  const startTour = () => {
    // only tour controls that are visible on THIS screen
    const available = ALL_STEPS.filter((s) => visible(s.selector));
    if (available.length === 0) {
      finish();
      return;
    }
    sfx('whoosh');
    setSteps(available);
    setPhase(0);
  };

  // Track the current step's target element (and follow it on resize). Also
  // watch for a dropdown opening/closing inside it — a MutationObserver fires
  // when the menu mounts/unmounts so the spotlight hole can grow to include it.
  useLayoutEffect(() => {
    if (typeof phase !== 'number') return;
    const el = visible(steps[phase]?.selector ?? '');
    const update = () => {
      setRect(el ? el.getBoundingClientRect() : null);
      const menu = el?.querySelector('.select__menu');
      setMenuRect(menu ? menu.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    const mo = el ? new MutationObserver(update) : null;
    mo?.observe(el as Node, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', update);
      mo?.disconnect();
    };
  }, [phase, steps]);

  const next = () => {
    if (typeof phase !== 'number') return;
    if (phase >= steps.length - 1) finish();
    else {
      sfx('whoosh');
      setPhase(phase + 1);
    }
  };
  const back = () => {
    if (typeof phase !== 'number' || phase === 0) return;
    sfx('tick');
    setPhase(phase - 1);
  };

  useEffect(() => {
    if (phase === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'welcome') decline();
        else skip();
      } else if (e.key === 'Enter' && typeof phase === 'number') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowRight' && typeof phase === 'number') {
        e.preventDefault();
        e.stopImmediatePropagation(); // don't also step the playback
        next();
      } else if (e.key === 'ArrowLeft' && typeof phase === 'number') {
        e.preventDefault();
        e.stopImmediatePropagation();
        back();
      }
    };
    // capture phase: runs before the playback shortcuts, so ← → move the tour
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, steps]);

  // Let the user freely USE the highlighted control (it shows through the
  // spotlight hole) — switch language, view or speed as many times as they
  // like. Interacting never advances; only the Next button does. The lone
  // exception is the last step, whose control IS Play: clicking it finishes
  // the tour (its own handler runs the code). Clicks anywhere else shake.
  useEffect(() => {
    if (typeof phase !== 'number') return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (document.querySelector('.tourPop')?.contains(target)) return; // popover buttons
      const step = steps[phase];
      const el = visible(step?.selector ?? '');
      if (el && el.contains(target) && step?.noInteract) {
        e.preventDefault();
        e.stopPropagation();
        bump();
      } else if (el && el.contains(target)) {
        // last step's control is Play → clicking it ends the tour and, via its
        // own onClick, starts playback. Other steps: interact freely, no advance.
        if (phase === steps.length - 1) finish();
      } else {
        bump();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [phase, steps]);

  if (phase === null) return null;

  if (phase === 'welcome') {
    return (
      <div className="overlay" onClick={bump}>
        <div
          className="dialog"
          ref={shakeRef}
          onAnimationEnd={onShakeEnd}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Codelapse"
        >
          <div className="dialog__head">
            <h2>Welcome to Codelapse</h2>
            <button className="icon-btn" onClick={decline} aria-label="Close">
              <CloseIcon size={13} />
            </button>
          </div>
          <p className="tourFact">
            <strong>Did you know?</strong> {fact}
          </p>
          <p className="dialog__mode">
            Codelapse turns your code into a video — watch every line run, with live variables, a 3D
            stage, and Lisa to explain it all. Want a 30-second tour?
          </p>
          <div className="tourActions">
            <button ref={primaryRef} className="btn btn--run" onClick={startTour}>
              Show me around
            </button>
            <button className="btn btn--ghost" onClick={decline}>
              Skip — I'll explore
            </button>
          </div>
          <p className="tourHint">
            You can replay it anytime with the <strong>Tutorial</strong> button at the top.
          </p>
        </div>
      </div>
    );
  }

  const step = steps[phase];
  if (!step) return null;
  const last = phase === steps.length - 1;

  // Popover placement: prefer a SIDE of the control (right, else left) so a
  // dropdown that opens directly below it (language / example) is never
  // covered. Only if neither side has room (narrow / mobile) do we fall back
  // to below, or above for controls low on the screen. Everything is clamped
  // so the card can never leave the viewport — with fallbacks so a
  // zero/degenerate viewport still positions sanely.
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  // must match .tourPop's width in index.css (wider card on narrow screens)
  const popWidth = vw <= 900 ? Math.min(320, vw - 24) : 280;
  const estHeight = 190; // rough card height, for vertical clamping only
  const gap = 16;
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;
  let popStyle: React.CSSProperties = {};
  let clip: string | undefined;
  if (rect) {
    // vertical anchor: align near the control's top, clamped into view
    const top = Math.max(12, Math.min(rect.top - 4, vh - estHeight - 12));
    const roomRight = vw - rect.right;
    const roomLeft = rect.left;
    if (roomRight >= popWidth + gap) {
      popStyle = { left: rect.right + gap, top };
    } else if (roomLeft >= popWidth + gap) {
      popStyle = { left: Math.max(12, rect.left - popWidth - gap), top };
    } else {
      // no side room — fall back to below (header) / above (playbar), centered
      const above = rect.top > vh * 0.55;
      // floor at 12 last, so a negative upper bound can never win
      const left = Math.max(
        12,
        Math.min(rect.left + rect.width / 2 - popWidth / 2, vw - popWidth - 12),
      );
      popStyle = above
        ? { left, bottom: Math.max(12, vh - rect.top + gap) }
        : { left, top: Math.min(rect.bottom + gap, vh - 12) };
    }

    // Spotlight hole: the scrim blurs/dims everything, this cut-out keeps the
    // highlighted control sharp. When a dropdown is open we grow the hole to
    // its bounding box too, so the popped-out options aren't blurred/dimmed.
    const pad = 8;
    const hL = menuRect ? Math.min(rect.left, menuRect.left) : rect.left;
    const hT = menuRect ? Math.min(rect.top, menuRect.top) : rect.top;
    const hR = menuRect ? Math.max(rect.right, menuRect.right) : rect.right;
    const hB = menuRect ? Math.max(rect.bottom, menuRect.bottom) : rect.bottom;
    const L = Math.max(0, hL - pad);
    const T = Math.max(0, hT - pad);
    const R = hR + pad;
    const B = hB + pad;
    clip = `polygon(0px 0px, 0px 100%, ${L}px 100%, ${L}px ${T}px, ${R}px ${T}px, ${R}px ${B}px, ${L}px ${B}px, ${L}px 100%, 100% 100%, 100% 0px)`;
  }

  return (
    <>
      {/* blur + dim scrim with a hole over the target (purely visual) */}
      <div
        className="tourScrim"
        aria-hidden="true"
        style={clip ? { clipPath: clip, WebkitClipPath: clip } : undefined}
      />
      {/* blocks non-highlighted controls; the hole (clip) lets the highlighted
          control show through and stay clickable. Clicks are routed by the
          document listener above — advance vs. shake. */}
      <div
        className="tourCatcher"
        aria-hidden="true"
        style={clip ? { clipPath: clip, WebkitClipPath: clip } : undefined}
      />
      {rect && (
        <div
          className="tourRing"
          aria-hidden="true"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        className="tourPop"
        ref={shakeRef}
        onAnimationEnd={onShakeEnd}
        style={popStyle}
        role="dialog"
        aria-label={step.title}
      >
        <div className="tourPop__head">
          <h3>{step.title}</h3>
          <button className="icon-btn tourPop__close" onClick={skip} aria-label="Skip tour">
            <CloseIcon size={12} />
          </button>
        </div>
        <p>{step.body}</p>
        <div className="tourPop__row">
          <span className="tourPop__dots" aria-label={`Step ${phase + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <i key={i} className={i === phase ? 'on' : ''} />
            ))}
          </span>
          {!last && (
            <button className="tourPop__skip" onClick={skip}>
              Skip
            </button>
          )}
          {phase > 0 && (
            <button className="btn btn--ghost btn--sm tourPop__back" onClick={back}>
              Back
            </button>
          )}
          <button className="btn btn--run tourPop__next" onClick={next}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
