import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef } from 'react';
import { activeLineField, setActiveLine } from '../editor/activeLine';
import { codelapseEditorTheme } from '../editor/editorTheme';
import { codelapseHighlight } from '../editor/highlight';
import type { Language } from '../types/trace';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  activeLine: number | null;
  language: Language;
  editable?: boolean;
}

const langExtension: Record<Language, () => ReturnType<typeof python>> = {
  python,
  javascript,
};

export function CodeEditor({
  value,
  onChange,
  activeLine,
  language,
  editable = true,
}: CodeEditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    const view = ref.current?.view;
    if (view) view.dispatch({ effects: setActiveLine.of(activeLine) });
  }, [activeLine]);

  const extensions = useMemo(
    () => [langExtension[language](), activeLineField, codelapseEditorTheme, codelapseHighlight],
    [language],
  );

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      editable={editable}
      theme="none"
      height="100%"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      extensions={extensions}
    />
  );
}
