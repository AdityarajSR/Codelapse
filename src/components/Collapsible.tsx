import type { ReactNode } from 'react';

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`chev${open ? ' chev--open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface PanelTitleProps {
  /** id of the body element this header shows/hides */
  bodyId: string;
  collapsed: boolean;
  onToggle: () => void;
  tick: 'vars' | 'out' | 'stack';
  title: string;
  /** small count/summary pill, shown open or collapsed */
  badge?: ReactNode;
}

/** A panel header that doubles as the collapse button for its body. */
export function PanelTitle({ bodyId, collapsed, onToggle, tick, title, badge }: PanelTitleProps) {
  return (
    <h2 className="panel__title">
      <button
        type="button"
        className="panel__toggle"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span className={`panel__tick panel__tick--${tick}`} aria-hidden="true" />
        {title}
        {badge != null && <span className="panel__count">{badge}</span>}
        <span className="panel__chev">
          <ChevronIcon open={!collapsed} />
          <span className="sr-only">{collapsed ? 'Expand' : 'Collapse'}</span>
        </span>
      </button>
    </h2>
  );
}

/** A small icon button that collapses a card (stage, assistant). */
export function CollapseButton({
  collapsed,
  onToggle,
  controls,
  label,
}: {
  collapsed: boolean;
  onToggle: () => void;
  controls: string;
  label: string;
}) {
  return (
    <button
      type="button"
      className="collapseBtn"
      aria-expanded={!collapsed}
      aria-controls={controls}
      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label}`}
      title={collapsed ? `Show ${label}` : `Hide ${label}`}
      onClick={onToggle}
    >
      <ChevronIcon open={!collapsed} />
    </button>
  );
}
