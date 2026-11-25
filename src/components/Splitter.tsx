import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface SplitterProps {
  /**
   * 'columns' — a vertical bar between side-by-side panes (drag left/right).
   * 'rows'    — a horizontal bar between stacked panes (drag up/down).
   */
  direction: 'columns' | 'rows';
  /** current size, in whatever unit `fromPointer` returns */
  value: number;
  min: number;
  max: number;
  /** keyboard step (same unit as value) */
  step: number;
  /** converts a pointer position into a new value */
  fromPointer: (clientX: number, clientY: number) => number | null;
  onChange: (value: number) => void;
  /** double-click / Enter: back to the default size */
  onReset: () => void;
  label: string;
  className?: string;
  /** rows only: the resized pane is ABOVE the bar, so ↓ grows it */
  paneAbove?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * A draggable divider. Works with mouse, touch and pen (pointer events with
 * capture), and with the keyboard (arrows, Home/End, Enter to reset) — it's a
 * proper ARIA separator.
 */
export function Splitter({
  direction,
  value,
  min,
  max,
  step,
  fromPointer,
  onChange,
  onReset,
  label,
  className = '',
  paneAbove = false,
}: SplitterProps) {
  const dragging = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add(direction === 'columns' ? 'is-resizing-x' : 'is-resizing-y');
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const v = fromPointer(e.clientX, e.clientY);
    if (v !== null) onChange(clamp(v, min, max));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    document.body.classList.remove('is-resizing-x', 'is-resizing-y');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // columns: → grows the left pane; rows: the arrow pointing away from the
    // resized pane grows it (↑ for a pane below the bar, ↓ for one above)
    const dec = direction === 'columns' ? 'ArrowLeft' : paneAbove ? 'ArrowUp' : 'ArrowDown';
    const inc = direction === 'columns' ? 'ArrowRight' : paneAbove ? 'ArrowDown' : 'ArrowUp';
    let next: number | null = null;
    if (e.key === dec) next = value - step;
    else if (e.key === inc) next = value + step;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'Enter') {
      e.preventDefault();
      onReset();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation(); // don't also step the playback
    onChange(clamp(next, min, max));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={direction === 'columns' ? 'vertical' : 'horizontal'}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      title={`Drag to resize · double-click to reset`}
      className={`splitter splitter--${direction} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    >
      <span className="splitter__grip" aria-hidden="true" />
    </div>
  );
}
