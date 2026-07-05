/**
 * Tiny inline-SVG icon set on a 24px grid — replaces the CSS border-hack
 * triangles that rendered fuzzy and optically misaligned. All icons inherit
 * currentColor; solid glyphs for transport, 2.2px strokes for utility icons.
 */

interface IconProps {
  size?: number;
}

const base = (size: number) =>
  ({ width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true }) as const;

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function PlayIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M8.4 5.5v13c0 .8.87 1.28 1.54.86l10.2-6.5a1.02 1.02 0 0 0 0-1.72L9.94 4.64c-.67-.42-1.54.06-1.54.86z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PauseIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="6.2" y="5" width="4.1" height="14" rx="1.4" fill="currentColor" />
      <rect x="13.7" y="5" width="4.1" height="14" rx="1.4" fill="currentColor" />
    </svg>
  );
}

export function StepBackIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14.5 6.5 9 12l5.5 5.5" {...stroke} />
    </svg>
  );
}

export function StepForwardIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m9.5 6.5 5.5 5.5-5.5 5.5" {...stroke} />
    </svg>
  );
}

export function JumpBackIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="5.5" width="2.4" height="13" rx="1.2" fill="currentColor" />
      <path
        d="M19 7.1v9.8c0 .8-.9 1.28-1.56.83l-7.2-4.9a1 1 0 0 1 0-1.66l7.2-4.9c.66-.45 1.56.03 1.56.83z"
        fill="currentColor"
      />
    </svg>
  );
}

export function JumpForwardIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path
        d="M5 7.1v9.8c0 .8.9 1.28 1.56.83l7.2-4.9a1 1 0 0 0 0-1.66l-7.2-4.9C5.9 5.82 5 6.3 5 7.1z"
        fill="currentColor"
      />
      <rect x="16.6" y="5.5" width="2.4" height="13" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function ShareIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.5V14" {...stroke} />
      <path d="M8 7l4-3.5L16 7" {...stroke} />
      <path d="M5 11.5v6A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-6" {...stroke} />
    </svg>
  );
}

export function DownloadIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4v10.5" {...stroke} />
      <path d="m8 11 4 4 4-4" {...stroke} />
      <path d="M5 19.5h14" {...stroke} />
    </svg>
  );
}

export function CloseIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />
    </svg>
  );
}

/** The brand mark: a play glyph on a gradient chip. */
export function BrandMark({ size = 26 }: IconProps) {
  return (
    <svg {...base(size)}>
      <defs>
        <linearGradient id="clbrand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a7cff" />
          <stop offset="1" stopColor="#33d6f5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#clbrand)" />
      <path
        d="M9.6 7.8v8.4c0 .62.68.99 1.2.66l6.6-4.2a.78.78 0 0 0 0-1.32l-6.6-4.2a.78.78 0 0 0-1.2.66z"
        fill="#07070c"
      />
    </svg>
  );
}
