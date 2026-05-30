export const MIN_TEACHING_PDF_ZOOM = 0.85;
export const MAX_TEACHING_PDF_ZOOM = 2.2;
export const PORTRAIT_TEACHING_PDF_DEFAULT_ZOOM = 1.12;
export const LANDSCAPE_TEACHING_PDF_DEFAULT_ZOOM = 1;

function sanitizeDimension(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number;
}

export function resolveTeachingPdfOrientation(width, height) {
  const safeWidth = sanitizeDimension(width);
  const safeHeight = sanitizeDimension(height);
  if (!safeWidth || !safeHeight) return "unknown";
  return safeHeight > safeWidth ? "portrait" : "landscape";
}

export function resolveTeachingPdfDefaultZoom(width, height) {
  return resolveTeachingPdfOrientation(width, height) === "portrait"
    ? PORTRAIT_TEACHING_PDF_DEFAULT_ZOOM
    : LANDSCAPE_TEACHING_PDF_DEFAULT_ZOOM;
}

export function clampTeachingPdfZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return LANDSCAPE_TEACHING_PDF_DEFAULT_ZOOM;
  const next = Math.min(MAX_TEACHING_PDF_ZOOM, Math.max(MIN_TEACHING_PDF_ZOOM, numeric));
  return Math.round(next * 100) / 100;
}

