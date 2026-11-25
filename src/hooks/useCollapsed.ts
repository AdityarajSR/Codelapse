import { useCallback, useEffect, useState } from 'react';

const KEY = 'codelapse.collapsed.v1';

function readAll(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Collapsed/expanded state for a section, remembered per viewer across
 * visits. Storage failures (private mode, blocked site data) just mean the
 * choice isn't remembered.
 */
export function useCollapsed(id: string, defaultCollapsed = false): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readAll()[id] ?? defaultCollapsed);

  useEffect(() => {
    try {
      const all = readAll();
      if (all[id] === collapsed) return;
      all[id] = collapsed;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      // not remembered — fine
    }
  }, [id, collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return [collapsed, toggle];
}
