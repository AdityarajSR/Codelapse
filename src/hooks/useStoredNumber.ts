import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'codelapse.size.';

function read(key: string): number | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * A number (a panel size) remembered per viewer. `null` means "not set —
 * use the layout's default". Storage failures just mean it isn't remembered.
 */
export function useStoredNumber(key: string): [number | null, (n: number) => void, () => void] {
  const [value, setValue] = useState<number | null>(() => read(key));

  useEffect(() => {
    try {
      if (value === null) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, String(Math.round(value * 1000) / 1000));
    } catch {
      // not remembered — fine
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(null), []);
  return [value, setValue, reset];
}
