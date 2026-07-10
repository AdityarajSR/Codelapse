import { useLayoutEffect, useRef } from 'react';
import type { StageModel } from './model';
import { pointerColor } from './model';
import { motionDisabled } from './motion';

interface Stage2DProps {
  model: StageModel | null;
}

/**
 * Flat fallback (and the "2D" toggle) for the data-structure stage. The row is
 * a line of FIXED slot columns (index labels and `i`/`j` pointer chips stay
 * bolted to the slot); the value tiles inside are keyed by element IDENTITY
 * and slide between slots via FLIP (WAAPI) when the algorithm moves them —
 * with a little arc so a swap reads as two tiles hopping over each other.
 */
export function Stage2D({ model }: Stage2DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Last known layout rect per element id, measured after every render.
  const rects = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => {
      const id = el.dataset.flipId!;
      // A glide may still be mid-flight (fast playback / scrubbing). Capture
      // its current visual offset, then CANCEL it before measuring — rects
      // must always be clean layout positions or deltas compound into
      // runaway animations.
      let ox = 0;
      let oy = 0;
      // WAAPI glides only — leave CSS entrance animations (which expose
      // animationName) alone so new tiles still pop in.
      const running = el.getAnimations().filter((a) => !('animationName' in a));
      if (running.length) {
        const t = getComputedStyle(el).transform;
        if (t && t !== 'none') {
          const m = new DOMMatrixReadOnly(t);
          ox = m.e;
          oy = m.f;
        }
        running.forEach((a) => a.cancel());
      }
      const rect = el.getBoundingClientRect();
      const prev = rects.current.get(id);
      next.set(id, rect);
      if (!prev || motionDisabled()) return;
      // A move re-parents the tile into another slot column (fresh DOM node) —
      // kill the entrance pop so only the glide plays.
      el.style.animation = 'none';
      // Start from where the eye last saw it: layout delta + in-flight offset.
      const dx = prev.left - rect.left + ox;
      const dy = prev.top - rect.top + oy;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      if (Math.abs(dx) > 2000 || Math.abs(dy) > 2000) return; // layout epoch changed — snap
      // FLIP with a mid-flight arc: rise while travelling, settle on arrival.
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx / 2}px, ${dy / 2 - 14}px)`, offset: 0.5 },
          { transform: 'none' },
        ],
        { duration: 360, easing: 'cubic-bezier(0.3, 0.9, 0.35, 1)' },
      );
    });
    rects.current = next;
  });

  if (!model) {
    return (
      <div className="stage__placeholder">
        <span className="stage__cube" aria-hidden="true" />
        <p>Run code with a list, dict, or string to see it here.</p>
      </div>
    );
  }

  if (model.kind === 'dict') {
    return (
      <div className="tiles" ref={rootRef}>
        {model.els.map((el) => (
          <div className="tile tile--kv" key={el.id} data-flip-id={el.id}>
            <span className="tile__k">{el.keyLabel}</span>
            {/* keyed by value so an in-place overwrite flashes */}
            <span className="tile__v tile__flash" key={el.label}>
              {el.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const showIdx = model.kind === 'array' || model.kind === 'string';
  const byIndex = new Map<number, typeof model.pointers>();
  for (const p of model.pointers) {
    const list = byIndex.get(p.index) ?? [];
    list.push(p);
    byIndex.set(p.index, list);
  }
  const hasPointers = model.pointers.length > 0;

  return (
    <div className="tiles" ref={rootRef}>
      {model.els.map((el, i) => (
        <div className="cell" key={i}>
          <div
            className={`tile${i === model.els.length - 1 ? ' tile--head' : ''}`}
            key={el.id}
            data-flip-id={el.id}
          >
            {/* keyed by value so an in-place overwrite flashes */}
            <span className="tile__flash" key={el.label}>
              {el.label}
            </span>
          </div>
          {showIdx && <span className="cell__idx">{i}</span>}
          {hasPointers && (
            <span className="cell__ptrs">
              {(byIndex.get(i) ?? []).map((p) => (
                <span className="cell__ptr" key={p.name} style={{ color: pointerColor(p.name) }}>
                  ▲ {p.name}={p.index}
                </span>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
