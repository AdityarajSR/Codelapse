export type MobileView = 'code' | 'visual' | 'assistant';

const VIEWS: { id: MobileView; label: string; icon: JSX.Element }[] = [
  {
    id: 'code',
    label: 'Code',
    icon: (
      <path
        d="M8 7l-5 5 5 5M16 7l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'visual',
    label: 'Visualize',
    icon: (
      <path
        d="M4 19V9m6 10V5m6 14v-7m4 7H2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: 'assistant',
    label: 'Assistant',
    icon: (
      <path
        fill="currentColor"
        d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"
      />
    ),
  },
];

interface MobileNavProps {
  view: MobileView;
  onChange: (view: MobileView) => void;
}

/** Section switcher shown only on narrow screens (see .mnav in index.css):
 * one focused view at a time instead of a very long scroll. */
export function MobileNav({ view, onChange }: MobileNavProps) {
  return (
    <nav className="mnav" aria-label="Sections">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`mnav__btn${view === v.id ? ' is-active' : ''}`}
          aria-pressed={view === v.id}
          onClick={() => onChange(v.id)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            {v.icon}
          </svg>
          {v.label}
        </button>
      ))}
    </nav>
  );
}
