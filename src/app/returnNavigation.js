import { withAuthSlot } from "./authStorage.js";
import { withAppBasePath } from "./basePath.js";

function canUseWindow() {
  return typeof window !== "undefined";
}

function normalizeHostname(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

function isSameHostnameFamily(leftHostname = "", rightHostname = "") {
  const left = normalizeHostname(leftHostname);
  const right = normalizeHostname(rightHostname);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.endsWith(`.${right}`) || right.endsWith(`.${left}`)) {
    return true;
  }
  const leftParent = left.includes(".") ? left.split(".").slice(1).join(".") : "";
  const rightParent = right.includes(".") ? right.split(".").slice(1).join(".") : "";
  return !!leftParent && leftParent === rightParent;
}

export function buildAbsoluteAppUrl(path = "", slot = "") {
  const scopedPath = withAuthSlot(path, slot);
  if (!canUseWindow()) return scopedPath;
  try {
    return new URL(withAppBasePath(scopedPath), window.location.origin).toString();
  } catch {
    return scopedPath;
  }
}

export function readReturnUrlFromSearch(search = "") {
  try {
    const params = new URLSearchParams(String(search || ""));
    return String(params.get("returnUrl") || "").trim();
  } catch {
    return "";
  }
}

export function isSafeReturnUrl(value = "") {
  if (!canUseWindow()) return false;
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return false;
    }
    const current = new URL(window.location.href);
    if (parsed.origin === current.origin) {
      return true;
    }
    return isSameHostnameFamily(parsed.hostname, current.hostname);
  } catch {
    return false;
  }
}

export function redirectToReturnUrl(value = "", { replace = true } = {}) {
  if (!canUseWindow()) return false;
  const raw = String(value || "").trim();
  if (!isSafeReturnUrl(raw)) return false;
  if (replace) {
    window.location.replace(raw);
  } else {
    window.location.assign(raw);
  }
  return true;
}
