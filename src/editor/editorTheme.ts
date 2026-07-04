import { EditorView } from '@codemirror/view';

/** Chrome-only theme tweaks; syntax colors come from CodeMirror's dark theme.
 * The execution-line glow (.cm-activeExecLine) lives in the global stylesheet. */
export const codelapseEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      fontSize: '13.5px',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.75',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-faint)',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-muted)' },
    '.cm-content': { caretColor: 'var(--accent)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
    },
  },
  { dark: true },
);
