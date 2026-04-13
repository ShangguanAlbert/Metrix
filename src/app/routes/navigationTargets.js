import { withAuthSlot } from "../authStorage.js";

export function buildModeSelectionRedirect(activeSlot) {
  return withAuthSlot("/mode-selection", activeSlot);
}

export function buildAdminHomeRedirect(activeSlot) {
  return withAuthSlot("/admin/settings", activeSlot);
}

export function buildLoginRedirect(activeSlot) {
  return withAuthSlot("/login", activeSlot);
}
