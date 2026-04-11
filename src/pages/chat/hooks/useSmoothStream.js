import { useCallback, useEffect, useRef } from "react";

const SEGMENTER_LOCALES = [
  "zh-CN",
  "zh-TW",
  "ja-JP",
  "en-US",
  "de-DE",
  "fr-FR",
  "es-ES",
  "ru-RU",
];

const supportsSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";

const segmenter = supportsSegmenter
  ? new Intl.Segmenter(SEGMENTER_LOCALES, { granularity: "grapheme" })
  : null;

function splitChunk(chunk) {
  const text = String(chunk || "");
  if (!text) return [];
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (item) => item.segment);
}

export function useSmoothStream({
  onUpdate,
  streamDone,
  minDelay = 10,
  initialText = "",
}) {
  const queueRef = useRef([]);
  const frameRef = useRef(null);
  const displayedTextRef = useRef(String(initialText || ""));
  const lastUpdateTimeRef = useRef(0);

  const addChunk = useCallback((chunk) => {
    const segments = splitChunk(chunk);
    if (segments.length === 0) return;
    queueRef.current = [...queueRef.current, ...segments];
  }, []);

  const reset = useCallback(
    (nextText = "") => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      queueRef.current = [];
      displayedTextRef.current = String(nextText || "");
      lastUpdateTimeRef.current = 0;
      onUpdate(displayedTextRef.current);
    },
    [onUpdate],
  );

  useEffect(() => {
    const renderLoop = (currentTime) => {
      if (queueRef.current.length === 0) {
        if (streamDone) {
          onUpdate(displayedTextRef.current);
          frameRef.current = null;
          return;
        }
        frameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (currentTime - lastUpdateTimeRef.current < minDelay) {
        frameRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      lastUpdateTimeRef.current = currentTime;

      let renderCount = Math.max(1, Math.floor(queueRef.current.length / 5));
      if (streamDone) {
        renderCount = queueRef.current.length;
      }

      const nextSegments = queueRef.current.slice(0, renderCount);
      displayedTextRef.current += nextSegments.join("");
      onUpdate(displayedTextRef.current);
      queueRef.current = queueRef.current.slice(renderCount);

      if (queueRef.current.length > 0 || !streamDone) {
        frameRef.current = requestAnimationFrame(renderLoop);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [minDelay, onUpdate, streamDone]);

  return { addChunk, reset };
}
