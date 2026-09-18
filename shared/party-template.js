export const PARTY_DOCUMENT_LIMIT = 200_000;
export const MAX_EXERCISE_RANGES = 40;

export function normalizeEditableRanges(value, length) {
  const ranges = (Array.isArray(value) ? value : []).filter((item) => (
    Number.isInteger(item?.from) && Number.isInteger(item?.to)
    && item.from >= 0 && item.to >= item.from && item.to <= length
  )).sort((a, b) => a.from - b.from || a.to - b.to);
  const result = [];
  for (const item of ranges) {
    if (result.length && item.from <= result.at(-1).to) continue;
    result.push({ id: String(item.id || `blank-${result.length + 1}`).slice(0, 80), from: item.from, to: item.to });
    if (result.length === MAX_EXERCISE_RANGES) break;
  }
  return result;
}

export function normalizeProgrammingTemplate(value) {
  const html = String(value?.html || "").replace(/\r\n/g, "\n").slice(0, PARTY_DOCUMENT_LIMIT);
  const css = String(value?.css || "").replace(/\r\n/g, "\n").slice(0, PARTY_DOCUMENT_LIMIT);
  return {
    html,
    css,
    editMode: value?.editMode === "fill" ? "fill" : "free",
    editableRanges: {
      html: normalizeEditableRanges(value?.editableRanges?.html, html.length),
      css: normalizeEditableRanges(value?.editableRanges?.css, css.length),
    },
  };
}
