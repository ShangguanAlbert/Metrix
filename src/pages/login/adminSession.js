import {
  LEGACY_ADMIN_TOKEN_STORAGE_KEY,
  clearScopedAdminToken,
  getScopedAdminToken,
  setScopedAdminToken,
} from "../../app/authStorage.js";

export const ADMIN_TOKEN_STORAGE_KEY = LEGACY_ADMIN_TOKEN_STORAGE_KEY;

export function getAdminToken() {
  return getScopedAdminToken();
}

export function setAdminToken(token) {
  setScopedAdminToken(token);
}

export function clearAdminToken() {
  clearScopedAdminToken();
}
