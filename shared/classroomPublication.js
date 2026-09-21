// A published snapshot remains stable while the teacher edits the next draft.
export function lessonSnapshot(lesson) {
  if (!lesson) return null;
  const snapshot = { ...lesson };
  delete snapshot.publication;
  return structuredClone(snapshot);
}

export function readPublishedLesson(lesson) {
  if (!lesson) return null;
  if (Object.hasOwn(lesson, "publication")) return lesson.publication?.snapshot || null;
  // Existing lessons predate explicit publishing; preserve their current visibility.
  return lesson;
}

export function preserveLessonPublication(previous) {
  if (previous && Object.hasOwn(previous, "publication")) return previous.publication;
  return {
    publishedAt: previous?.updatedAt || previous?.createdAt || "",
    snapshot: lessonSnapshot(previous),
  };
}

export function publishedLessonFileIds(lesson) {
  const published = readPublishedLesson(lesson);
  return new Set([
    ...(published?.files || []),
    ...(published?.tasks || []).flatMap((task) => task.files || []),
  ].map((file) => file.id));
}

export function lessonHasUnpublishedChanges(lesson) {
  if (!lesson || !Object.hasOwn(lesson, "publication")) return false;
  if (!lesson.publication?.snapshot) return true;
  const comparable = (value) => {
    const snapshot = lessonSnapshot(value);
    delete snapshot.createdAt;
    delete snapshot.updatedAt;
    return JSON.stringify(snapshot, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  };
  return comparable(lesson) !== comparable(lesson.publication.snapshot);
}
