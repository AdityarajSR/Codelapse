import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** Effect to move the "currently executing" line highlight. */
export const setActiveLine = StateEffect.define<number | null>();

const execLine = Decoration.line({ class: 'cm-activeExecLine' });

export const activeLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setActiveLine)) {
        const lineNo = effect.value;
        if (lineNo == null || lineNo < 1 || lineNo > tr.state.doc.lines) {
          deco = Decoration.none;
        } else {
          const line = tr.state.doc.line(lineNo);
          deco = Decoration.set([execLine.range(line.from)]);
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});
