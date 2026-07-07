import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronIcon } from './Icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** consecutive options sharing a group render a small heading once */
  group?: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  icon?: ReactNode;
}

/**
 * A custom dropdown — native <select> option lists can't be dark-themed, so we
 * render our own button + listbox that matches the design system. Keyboard
 * accessible (arrows, Home/End, Enter, Esc), closes on outside click.
 */
export function Select({ value, options, onChange, ariaLabel, className, icon }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, options, value]);

  const choose = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const move = (dir: 1 | -1) => {
    const pos = enabled.indexOf(active);
    const next =
      pos === -1
        ? enabled[dir === 1 ? 0 : enabled.length - 1]
        : enabled[(pos + dir + enabled.length) % enabled.length];
    setActive(next);
  };

  const onKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (open) move(1);
        else setOpen(true);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) move(-1);
        else setOpen(true);
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActive(enabled[0]);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActive(enabled[enabled.length - 1]);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) setOpen(true);
        else if (options[active]) choose(options[active]);
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  let lastGroup: string | undefined;

  return (
    <div className={`select${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button"
        className="select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        {icon && <span className="select__icon">{icon}</span>}
        <span className="select__value">{current?.label ?? ''}</span>
        <span className={`select__chev${open ? ' select__chev--open' : ''}`} aria-hidden="true">
          <ChevronIcon size={12} />
        </span>
      </button>

      {open && (
        <ul className="select__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt, i) => {
            const showGroup = opt.group && opt.group !== lastGroup;
            lastGroup = opt.group;
            const selected = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                {showGroup && <div className="select__group">{opt.group}</div>}
                <div
                  role="option"
                  aria-selected={selected}
                  aria-disabled={opt.disabled || undefined}
                  className={
                    'select__opt' +
                    (selected ? ' select__opt--selected' : '') +
                    (i === active && !opt.disabled ? ' select__opt--active' : '') +
                    (opt.disabled ? ' select__opt--disabled' : '')
                  }
                  onMouseEnter={() => !opt.disabled && setActive(i)}
                  onClick={() => choose(opt)}
                >
                  <span>{opt.label}</span>
                  {selected && (
                    <span className="select__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
