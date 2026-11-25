import { useCollapsed } from '../hooks/useCollapsed';
import { PanelTitle } from './Collapsible';

interface OutputPanelProps {
  text: string;
}

export function OutputPanel({ text }: OutputPanelProps) {
  const [collapsed, toggle] = useCollapsed('output');
  const lines = text.length === 0 ? 0 : text.replace(/\n$/, '').split('\n').length;

  return (
    <section className={`panel${collapsed ? ' panel--collapsed' : ''}`}>
      <PanelTitle
        bodyId="panel-output"
        collapsed={collapsed}
        onToggle={toggle}
        tick="out"
        title="Output"
        badge={lines > 0 ? `${lines} line${lines === 1 ? '' : 's'}` : undefined}
      />
      {!collapsed && (
        <div className="panel__body" id="panel-output" aria-live="polite">
          {text.length === 0 ? (
            <p className="empty">No output yet.</p>
          ) : (
            <pre className="output">
              {text}
              <span className="output__caret" aria-hidden="true" />
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
