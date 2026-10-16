import { useCallback, useEffect, useRef } from "react";
import { createActivityClient, openActivityStore, sendActivity } from "./activityClient.js";

export function usePartyActivity({ roomId, userId, enabled, connectionStatus }) {
  const clientRef = useRef(null);
  const capture = useCallback((type, metadata) => clientRef.current?.record(type, metadata), []);
  useEffect(() => {
    if (!enabled || !roomId || !userId) return undefined;
    const client = createActivityClient({ roomId, userId, store: openActivityStore(window.indexedDB, userId), send: sendActivity });
    clientRef.current = client;
    const startedAt = Date.now();
    let lastInteractionAt = startedAt;
    const observed = new Set();
    const visibleTimers = new Map();
    const state = () => ({ visible: document.visibilityState === "visible", focused: document.hasFocus(),
      lastInteractionAt: new Date(lastInteractionAt).toISOString(), elapsedMs: Date.now() - startedAt });
    client.record("session_start", state());
    const visibility = () => {
      client.record("page_visibility", state()); void client.flush();
      if (document.visibilityState === "visible") {
        document.querySelectorAll("[data-activity-message]").forEach((node) => { observer.unobserve(node); observer.observe(node); });
      }
    };
    const focus = () => client.record("page_focus", state());
    const activity = () => { lastInteractionAt = Date.now(); };
    const pagehide = () => { client.record("session_end", { ...state(), reason: "pagehide" }); void client.flush(); };
    const online = () => { client.record("connection_status", { status: navigator.onLine ? "online" : "offline" }); void client.flush(); };
    const click = (event) => {
      const control = event.target.closest?.("button,a,select");
      if (!control || !control.closest(".party-chat-page,.party-content,.party-sidebar,.party-web-panel,.party-lesson-board")) return;
      client.record("ui_action", { label: (control.getAttribute("aria-label") || control.textContent || "").trim().slice(0, 100),
        action: control.tagName.toLowerCase(), messageId: control.closest("[data-activity-message]")?.dataset.activityMessage || "" });
    };
    const copy = () => {
      const node = window.getSelection()?.anchorNode?.parentElement?.closest("[data-activity-message]");
      if (node) client.record("message_copy", { messageId: node.dataset.activityMessage, senderKind: node.dataset.activitySender });
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const node = entry.target;
        if (!entry.isIntersecting) { clearTimeout(visibleTimers.get(node)); visibleTimers.delete(node); return; }
        const key = `${node.dataset.activityMessage}:${node.dataset.activityVersion || ""}`;
        if (observed.has(key) || visibleTimers.has(node)) return;
        visibleTimers.set(node, setTimeout(() => {
          visibleTimers.delete(node);
          if (document.visibilityState !== "visible" || !node.isConnected) return;
          observed.add(key);
          client.record("message_visible", { messageId: node.dataset.activityMessage, senderKind: node.dataset.activitySender });
        }, 1000));
      });
    }, { threshold: 0.25 });
    const watch = (root) => {
      root.querySelectorAll?.("[data-activity-message]").forEach((node) => observer.observe(node));
      if (root.matches?.("[data-activity-message]")) observer.observe(root);
    };
    watch(document);
    const mutations = new MutationObserver((entries) => entries.forEach((entry) => {
      entry.addedNodes.forEach(watch);
      if (entry.type === "attributes") { observer.unobserve(entry.target); observer.observe(entry.target); }
    }));
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-activity-version"] });
    const listeners = [[document, "visibilitychange", visibility], [window, "focus", focus], [window, "blur", focus],
      [window, "pagehide", pagehide], [window, "online", online], [window, "offline", online],
      [document, "pointerdown", activity], [document, "keydown", activity], [document, "click", click], [document, "copy", copy]];
    listeners.forEach(([target, type, fn]) => target.addEventListener(type, fn, { passive: true }));
    const heartbeat = setInterval(() => client.record("session_heartbeat", state()), 15000);
    const flushTimer = setInterval(() => void client.flush(), 3000);
    void client.flush();
    return () => {
      client.record("session_end", { ...state(), reason: "room_or_route_change" });
      void client.flush();
      clearInterval(heartbeat); clearInterval(flushTimer);
      visibleTimers.forEach(clearTimeout); observer.disconnect(); mutations.disconnect();
      listeners.forEach(([target, type, fn]) => target.removeEventListener(type, fn));
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [enabled, roomId, userId]);
  useEffect(() => { capture("connection_status", { status: connectionStatus }); }, [capture, connectionStatus, roomId]);
  return capture;
}
