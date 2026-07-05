import { python } from '@codemirror/lang-python';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEffect, useRef } from 'react';
import { activeLineField, setActiveLine } from '../editor/activeLine';
import { codelapseEditorTheme } from '../editor/editorTheme';
import { codelapseHighlight } from '../editor/highlight';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  activeLine: number | null;
  editable?: boolean;
}

const extensions = [python(), activeLineField, codelapseEditorTheme, codelapseHighlight];

export function CodeEditor({ value, onChange, activeLine, editable = true }: CodeEditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    const view = ref.current?.view;
    if (view) view.dispatch({ effects: setActiveLine.of(activeLine) });
  }, [activeLine]);

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
