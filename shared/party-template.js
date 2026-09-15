export const PARTY_DOCUMENT_LIMIT = 200_000;

export function normalizeProgrammingTemplate(value) {
  return {
    html: String(value?.html || "").replace(/\r\n/g, "\n").slice(0, PARTY_DOCUMENT_LIMIT),
    css: String(value?.css || "").replace(/\r\n/g, "\n").slice(0, PARTY_DOCUMENT_LIMIT),
  };
}
