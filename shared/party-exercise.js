import * as Y from "yjs";

export const EXERCISE_MAP = "lesson-exercise";
const FILES = ["html", "css"];

export function readExercise(doc) {
  return doc?.getMap(EXERCISE_MAP).get("definition") || null;
}

export function resolveExerciseRanges(doc, file) {
  const definition = readExercise(doc);
  if (!definition) return [];
  const text = doc.getText(file);
  return (definition[file]?.ranges || []).map((range) => {
    const from = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(range.from), doc);
    const to = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(range.to), doc);
    if (!from || !to || from.type !== text || to.type !== text) return null;
    return { id: range.id, from: from.index, to: to.index };
  });
}

export function lockedSegments(code, ranges) {
  let cursor = 0;
  const locked = [];
  for (const range of ranges) {
    if (!range || range.from < cursor || range.to < range.from || range.to > code.length) return null;
    locked.push(code.slice(cursor, range.from));
    cursor = range.to;
  }
  locked.push(code.slice(cursor));
  return locked;
}

// Relative positions survive typing, deletion to an empty answer, sync, and reload.
export function initializeExercise(doc, template, version) {
  if (template.editMode !== "fill") return;
  const definition = { version };
  for (const file of FILES) {
    const text = doc.getText(file);
    const ranges = template.editableRanges?.[file] || [];
    definition[file] = {
      locked: lockedSegments(text.toString(), ranges),
      ranges: ranges.map((range) => ({
        id: range.id,
        from: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, range.from, -1)),
        to: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, range.to, 0)),
      })),
    };
  }
  doc.getMap(EXERCISE_MAP).set("definition", definition);
}

export function exerciseSnapshot(doc) {
  const definition = readExercise(doc);
  if (!definition) return null;
  return { version: definition.version, editableRanges: Object.fromEntries(FILES.map((file) => [file, resolveExerciseRanges(doc, file)])) };
}

export function validateExerciseDocument(doc, trustedDefinition) {
  if (JSON.stringify(readExercise(doc)) !== JSON.stringify(trustedDefinition)) return false;
  if (!trustedDefinition) return true;
  return FILES.every((file) => {
    const text = doc.getText(file);
    if (text.length > 200_000) return false;
    const locked = lockedSegments(text.toString(), resolveExerciseRanges(doc, file));
    return locked !== null && JSON.stringify(locked) === JSON.stringify(trustedDefinition[file].locked);
  });
}

export function validateExerciseUpdate(doc, update) {
  const candidate = new Y.Doc();
  try {
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc));
    // Materialize the root shared types before applying untrusted changes.
    candidate.getText("html"); candidate.getText("css"); candidate.getMap(EXERCISE_MAP);
    Y.applyUpdate(candidate, update);
    return validateExerciseDocument(candidate, readExercise(doc));
  } catch { return false; }
  finally { candidate.destroy(); }
}
