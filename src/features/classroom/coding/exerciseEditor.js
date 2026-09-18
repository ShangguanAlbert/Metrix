import { EditorState, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { readExercise, resolveExerciseRanges } from "../../../../shared/party-exercise.js";

class EmptyAnswer extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "party-exercise-empty";
    span.textContent = "填写…";
    return span;
  }
  ignoreEvent() { return false; }
}

export function rangeDecorations(ranges, className) {
  return Decoration.set(ranges.filter(Boolean).map((range) => range.from === range.to
    ? Decoration.widget({ widget: new EmptyAnswer(), side: 1 }).range(range.from)
    : Decoration.mark({ class: className }).range(range.from, range.to)), true);
}

export function changesStayInRanges(changes, ranges) {
  let allowed = true;
  changes.iterChanges((from, to) => {
    if (!ranges.some((range) => range && from >= range.from && to <= range.to)) allowed = false;
  });
  return allowed;
}

export function createExerciseEditor({ doc, file, onBlocked }) {
  if (!readExercise(doc)) return [];
  const ranges = StateField.define({
    create: () => resolveExerciseRanges(doc, file),
    update(value, transaction) {
      if (!transaction.docChanged) return value;
      // Yjs remote changes and undo reach Y.Text before CodeMirror; local input does not.
      if (transaction.newDoc.toString() === doc.getText(file).toString()) return resolveExerciseRanges(doc, file);
      return value.map((range) => ({ ...range, from: transaction.changes.mapPos(range.from, -1), to: transaction.changes.mapPos(range.to, 1) }));
    },
    provide: (field) => EditorView.decorations.from(field, (value) => rangeDecorations(value, "party-exercise-fill")),
  });
  return [
    ranges,
    EditorState.transactionFilter.of((transaction) => {
      if (!transaction.docChanged || transaction.newDoc.toString() === doc.getText(file).toString()) return transaction;
      if (changesStayInRanges(transaction.changes, transaction.startState.field(ranges))) return transaction;
      onBlocked();
      return [];
    }),
    EditorView.contentAttributes.of({ "aria-label": `${file.toUpperCase()} 填空练习，只能编辑高亮填写区` }),
  ];
}
