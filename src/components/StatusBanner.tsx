import type { Trace } from '../types/trace';

interface StatusBannerProps {
  trace: Trace | null;
  workerError: string | null;
}

/** The designed edge-state surface (PLAN.md §9.4). Friendly, plain-language,
 * never a raw traceback. Hidden on a clean "ok" run. */
export function StatusBanner({ trace, workerError }: StatusBannerProps) {
  if (workerError) {
    return (
      <div className="banner banner--error" role="alert">
        <strong>Something went wrong running your code.</strong>
        <span>{workerError}</span>
      </div>
    );
  }
  if (!trace) return null;

  const diag = trace.diagnostics[0];

  switch (trace.status) {
    case 'compile-error':
      return (
        <div className="banner banner--error" role="alert">
          <strong>Syntax error{diag?.line ? ` on line ${diag.line}` : ''}.</strong>
          <span>{diag?.message ?? 'Check your code and try again.'}</span>
        </div>
      );
    case 'runtime-error':
      return (
        <div className="banner banner--warn" role="alert">
          <strong>
            {diag?.type ?? 'Error'}
            {diag?.line ? ` on line ${diag.line}` : ''} — the trace stops here.
          </strong>
          <span>{diag?.message}</span>
        </div>
      );
    case 'step-cap':
      return (
        <div className="banner banner--info" role="status">
          <strong>Your program ran a lot of steps.</strong>
          <span>
            We stopped after {trace.steps.length.toLocaleString()} steps — likely a long or infinite
            loop.
          </span>
        </div>
      );
    case 'output-cap':
      return (
        <div className="banner banner--info" role="status">
          <strong>That produced a lot of output.</strong>
          <span>We stopped capturing after the output got very large.</span>
        </div>
      );
    default:
      return null;
  }
}
