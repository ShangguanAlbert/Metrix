function parseIsoTimeMs(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : Number.NaN;
}

function resolveLessonStartMs(lesson) {
  const startMs = parseIsoTimeMs(lesson?.courseStartAt);
  if (Number.isFinite(startMs)) return startMs;
  const legacy = String(lesson?.courseTime || "").trim();
  const legacyMatch = legacy.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}:\d{2})/,
  );
  if (!legacyMatch) return Number.NaN;
  const [, year, month, day, timeText] = legacyMatch;
  return parseIsoTimeMs(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timeText}:00`,
  );
}

export function getStudentHomeworkHistoryLessons(
  lessons = [],
  submissionsByLesson = {},
  options = {},
) {
  const nowMs = Number.isFinite(options?.nowMs) ? options.nowMs : Date.now();
  const source = Array.isArray(lessons) ? lessons : [];
  return source
    .map((lesson) => {
      const id = String(lesson?.id || "").trim();
      const submissions = Array.isArray(submissionsByLesson?.[id])
        ? submissionsByLesson[id]
        : [];
      return {
        ...lesson,
        id,
        startMs: resolveLessonStartMs(lesson),
        submissions,
        submitted: submissions.length > 0,
        submissionCount: submissions.length,
      };
    })
    .filter(
      (lesson) =>
        lesson.id &&
        Number.isFinite(lesson.startMs) &&
        lesson.startMs <= nowMs &&
        lesson.homeworkUploadEnabled !== false,
    )
    .sort((a, b) => b.startMs - a.startMs);
}
