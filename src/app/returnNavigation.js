import { withAuthSlot } from "./authStorage.js";
import { withAppBasePath } from "./basePath.js";

const RETURN_URL_PARAM = "returnUrl";
const RETURN_URL_KEY_PARAM = "returnKey";
const RETURN_URL_STORAGE_PREFIX = "educhat.return-url:";

function canUseWindow() {
  return typeof window !== "undefined";
}

function canUseSessionStorage() {
  if (!canUseWindow()) return false;
  try {
    return !!window.sessionStorage;
  } catch {
    return false;
  }
}

function buildReturnUrlStorageKey(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let hash = 5381;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(index);
  }
  return `ru_${(hash >>> 0).toString(36)}`;
}

function writeStoredReturnUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw || !canUseSessionStorage()) return "";
  const key = buildReturnUrlStorageKey(raw);
  if (!key) return "";
  try {
    window.sessionStorage.setItem(`${RETURN_URL_STORAGE_PREFIX}${key}`, raw);
    return key;
  } catch {
    return "";
  }
}

function readStoredReturnUrl(key = "") {
  const safeKey = String(key || "").trim();
  if (!safeKey || !canUseSessionStorage()) return "";
  try {
    return String(
      window.sessionStorage.getItem(`${RETURN_URL_STORAGE_PREFIX}${safeKey}`) || "",
    ).trim();
  } catch {
    return "";
  }
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
    const inlineValue = String(params.get(RETURN_URL_PARAM) || "").trim();
    if (inlineValue) {
      writeStoredReturnUrl(inlineValue);
      return inlineValue;
    }
    return readStoredReturnUrl(params.get(RETURN_URL_KEY_PARAM));
  } catch {
    return "";
  }
}

export function appendReturnUrlParam(params, value = "") {
  if (!(params instanceof URLSearchParams)) {
    return params;
  }
  const raw = String(value || "").trim();
  if (!raw) return params;

  const key = writeStoredReturnUrl(raw);
  params.delete(RETURN_URL_PARAM);
  if (key) {
    params.set(RETURN_URL_KEY_PARAM, key);
  } else {
    params.set(RETURN_URL_PARAM, raw);
  }
  return params;
}

export function compactReturnUrlSearch(search = "") {
  try {
    const params = new URLSearchParams(String(search || ""));
    const raw = String(params.get(RETURN_URL_PARAM) || "").trim();
    if (!raw) {
      return params.toString() ? `?${params.toString()}` : "";
    }
    appendReturnUrlParam(params, raw);
    return params.toString() ? `?${params.toString()}` : "";
  } catch {
    return String(search || "");
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
