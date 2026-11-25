import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { useStoredNumber } from '../hooks/useStoredNumber';
import type { MobileView } from './MobileNav';
import { Splitter } from './Splitter';

interface WorkspaceProps {
  mobileView: MobileView;
  editor: ReactNode;
  assistant: ReactNode;
  /** renders its own `.col.col--right` element */
  right: ReactNode;
}

/** Defaults when the viewer hasn't resized anything (percent). */
const DEFAULT_SPLIT = 48;
const DEFAULT_ASSIST = 42;
/** half of the splitter's thickness, so the bar stays under the pointer */
const HALF_BAR = 8;

/**
 * The two-column work area with draggable dividers: left/right columns and
 * editor/assistant. Sizes are remembered per viewer. On narrow screens the
 * dividers are hidden and MobileNav shows one view at a time (index.css).
 */
export function Workspace({ mobileView, editor, assistant, right }: WorkspaceProps) {
  const mainRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const [split, setSplit, resetSplit] = useStoredNumber('columns');
  const [assist, setAssist, resetAssist] = useStoredNumber('assistant');

  const splitFromPointer = useCallback((x: number) => {
    const left = leftRef.current?.getBoundingClientRect();
    const rightCol = mainRef.current?.querySelector('.col--right')?.getBoundingClientRect();
    if (!left || !rightCol) return null;
    const width = rightCol.right - left.left;
    return width > 0 ? ((x - left.left - HALF_BAR) / width) * 100 : null;
  }, []);

  const assistFromPointer = useCallback((_x: number, y: number) => {
    const col = leftRef.current?.getBoundingClientRect();
    if (!col || col.height <= 0) return null;
    return ((col.bottom - y - HALF_BAR) / col.height) * 100;
  }, []);

  const style = {
    ...(split !== null ? { '--split': `${split}%` } : {}),
    ...(assist !== null ? { '--assist-h': `${assist}%` } : {}),
  } as CSSProperties;

  return (
    <main
      id="main"
      tabIndex={-1}
      className="workspace"
      data-mview={mobileView}
      ref={mainRef}
      style={style}
    >
      <div className={`col col--editor${assist !== null ? ' has-assist-h' : ''}`} ref={leftRef}>
        {editor}
        <Splitter
          direction="rows"
          className="splitter--assistant"
          label="Resize the assistant"
          value={assist ?? DEFAULT_ASSIST}
          min={14}
          max={78}
          step={4}
          fromPointer={assistFromPointer}
          onChange={setAssist}
          onReset={resetAssist}
        />
        {assistant}
      </div>
      <Splitter
        direction="columns"
        className="splitter--columns"
        label="Resize the code and visualization columns"
        value={split ?? DEFAULT_SPLIT}
        min={28}
        max={72}
        step={3}
        fromPointer={splitFromPointer}
        onChange={setSplit}
        onReset={resetSplit}
      />
      {right}
    </main>
  );
}
