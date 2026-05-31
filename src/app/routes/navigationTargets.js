import { withAuthSlot } from "../authStorage.js";

export function buildModeSelectionRedirect(activeSlot) {
  return withAuthSlot("/mode-selection", activeSlot);
}

export function buildModeSelectionPanelRedirect(activeSlot, panel = "") {
  const base = buildModeSelectionRedirect(activeSlot);
  const safePanel = String(panel || "").trim();
  if (!safePanel) return base;
  const connector = base.includes("?") ? "&" : "?";
  return `${base}${connector}panel=${encodeURIComponent(safePanel)}`;
}

export function buildAdminHomeRedirect(activeSlot) {
  return withAuthSlot("/admin/settings", activeSlot);
}

export function buildLoginRedirect(activeSlot) {
  return withAuthSlot("/login", activeSlot);
}
