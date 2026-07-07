import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseIcon } from './Icons';

const KEY = 'codelapse.tour.v1';

// Rotates daily — deterministic, no randomness needed.
const FACTS = [
  'The first computer "bug" was a real moth, taped into Harvard\'s Mark II logbook in 1947.',
  'Python is named after Monty Python — not the snake.',
  'Ada Lovelace wrote the first algorithm in 1843, a century before computers existed.',
  'JavaScript was built in just 10 days in 1995.',
  'The first 1GB hard drive (1980) weighed 250 kg — heavier than a fridge.',
];

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const ALL_STEPS: TourStep[] = [
  {
    selector: '.langPicker',
    title: 'Pick a language',
    body: 'Python and JavaScript run right in your browser. Java, C and C++ are on the way.',
  },
  {
    selector: '.stage .toggle',
    title: '3D or 2D',
    body: 'Your lists and dicts appear as 3D objects on the stage — drag to orbit, or flip to flat 2D.',
  },
  {
    selector: '.speed',
    title: 'Set the pace',
    body: 'Slow down to follow every step, or crank it to 16× for long loops.',
  },
  {
    selector: '.playbar .icon-btn--primary',
    title: 'Press play',
    body: 'Your code becomes a video — play it, pause it, scrub it. Space works too. Go!',
  },
];

type Phase = 'welcome' | number | null;

function remember(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage blocked — they'll just see it again */
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
    try {
      if (!localStorage.getItem(KEY)) setPhase('welcome');
    } catch {
      /* storage blocked — don't show */
    }
  }, []);

  useEffect(() => {
    if (phase === 'welcome') primaryRef.current?.focus();
  }, [phase]);

  const decline = () => {
    remember('declined');
    setPhase(null);
  };
  const finish = () => {
    remember('done');
    setPhase(null);
  };
  const startTour = () => {
    // only tour controls that actually exist (e.g. no 3D toggle without WebGL)
    const available = ALL_STEPS.filter((s) => document.querySelector(s.selector));
    if (available.length === 0) {
      finish();
      return;
    }
    setSteps(available);
    setPhase(0);
  };

  // Track the current step's target element (and follow it on resize).
  useLayoutEffect(() => {
    if (typeof phase !== 'number') return;
    const update = () => {
      const el = document.querySelector(steps[phase]?.selector ?? '');
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [phase, steps]);

  const next = () => {
    if (typeof phase !== 'number') return;
    if (phase >= steps.length - 1) finish();
    else setPhase(phase + 1);
  };

  useEffect(() => {
    if (phase === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'welcome') decline();
        else finish();
      } else if (e.key === 'Enter' && typeof phase === 'number') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, steps]);

  if (phase === null) return null;

  if (phase === 'welcome') {
    const fact = FACTS[new Date().getDate() % FACTS.length];
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
            Codelapse turns your code into a video — watch every line run, with live variables and a
            3D stage. Want a quick 20-second tour?
          </p>
          <div className="tourActions">
            <button ref={primaryRef} className="btn btn--run" onClick={startTour}>
              Show me around
            </button>
            <button className="btn btn--ghost" onClick={decline}>
              No thanks
            </button>
          </div>
        </div>
      </div>
    );
  }

  const step = steps[phase];
  if (!step) return null;
  const last = phase === steps.length - 1;

  // Popover placement: above targets in the lower half (the playbar), below
  // targets in the header; clamped so it can never leave the viewport — with
  // fallbacks so a zero/degenerate viewport still positions sanely.
  const popWidth = 280;
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;
  let popStyle: React.CSSProperties = {};
  let clip: string | undefined;
  if (rect) {
    const above = rect.top > vh * 0.55;
    // floor at 12 last, so a negative upper bound can never win
    const left = Math.max(
      12,
      Math.min(rect.left + rect.width / 2 - popWidth / 2, vw - popWidth - 12),
    );
    popStyle = above
      ? { left, bottom: Math.max(12, vh - rect.top + 14) }
      : { left, top: Math.min(rect.bottom + 14, vh - 12) };

    // Spotlight hole: the scrim blurs/dims everything, this cut-out keeps the
    // highlighted control sharp. A single clip-path ring seamed to the notch.
    const pad = 8;
    const L = Math.max(0, rect.left - pad);
    const T = Math.max(0, rect.top - pad);
    const R = rect.right + pad;
    const B = rect.bottom + pad;
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
      {/* catches every click outside the popover → shake ("finish first") */}
      <div className="tourCatcher" onClick={bump} />
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
          <button className="icon-btn tourPop__close" onClick={finish} aria-label="Skip tour">
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
          <button className="btn btn--run tourPop__next" onClick={next}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
