import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { randomFact } from '../lib/facts';
import { CloseIcon } from './Icons';

const KEY = 'codelapse.tour.v1';

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const ALL_STEPS: TourStep[] = [
  {
    selector: '.langSelect',
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

  // Track the current step's target element (and follow it on resize). Also
  // watch for a dropdown opening/closing inside it — a MutationObserver fires
  // when the menu mounts/unmounts so the spotlight hole can grow to include it.
  useLayoutEffect(() => {
    if (typeof phase !== 'number') return;
    const el = document.querySelector(steps[phase]?.selector ?? '');
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
      const el = document.querySelector(steps[phase]?.selector ?? '');
      if (el && el.contains(target)) {
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

  // Popover placement: prefer a SIDE of the control (right, else left) so a
  // dropdown that opens directly below it (language / example) is never
  // covered. Only if neither side has room (narrow / mobile) do we fall back
  // to below, or above for controls low on the screen. Everything is clamped
  // so the card can never leave the viewport — with fallbacks so a
  // zero/degenerate viewport still positions sanely.
  const popWidth = 280;
  const estHeight = 172; // rough card height, for vertical clamping only
  const gap = 16;
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
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
