import { compareStudentLessons } from "../../../shared/classroomPublication.js";

export function reconcileStudentLessons(previous, plans) {
  const lessons = [...plans].sort(compareStudentLessons);
  const latest = lessons[0];
  const publicationKey = latest ? `${latest.id}:${latest.publishedAt || ""}` : "";
  const keepSelection = previous.publicationKey === publicationKey
    && lessons.some((lesson) => lesson.id === previous.selectedId);
  return {
    lessons,
    publicationKey,
    selectedId: keepSelection ? previous.selectedId : latest?.id || "",
  };
}
