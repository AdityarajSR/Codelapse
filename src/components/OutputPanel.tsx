interface OutputPanelProps {
  text: string;
}

export function OutputPanel({ text }: OutputPanelProps) {
  return (
    <section className="panel">
      <h2 className="panel__title">
        <span className="panel__tick panel__tick--out" aria-hidden="true" />
        Output
      </h2>
      <div className="panel__body" aria-live="polite">
        {text.length === 0 ? (
          <p className="empty">No output yet.</p>
        ) : (
          <pre className="output">
            {text}
            <span className="output__caret" aria-hidden="true" />
          </pre>
        )}
      </div>
    </section>
  );
}
