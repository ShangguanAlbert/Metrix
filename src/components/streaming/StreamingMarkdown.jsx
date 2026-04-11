import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSmoothStream } from "../../pages/chat/hooks/useSmoothStream.js";

function defaultNormalize(value) {
  return String(value || "");
}

const StreamingMarkdown = memo(function StreamingMarkdown({
  content = "",
  streaming = false,
  normalizeContent = defaultNormalize,
  remarkPlugins,
  rehypePlugins,
  components,
}) {
  const normalize = useCallback(
    (value) => {
      if (typeof normalizeContent !== "function") {
        return defaultNormalize(value);
      }
      return String(normalizeContent(value) || "");
    },
    [normalizeContent],
  );
  const [displayedContent, setDisplayedContent] = useState(() =>
    normalize(content),
  );
  const prevContentRef = useRef(normalize(content));

  const { addChunk, reset } = useSmoothStream({
    onUpdate: setDisplayedContent,
    streamDone: !streaming,
    initialText: normalize(content),
  });

  useEffect(() => {
    const nextContent = normalize(content);
    const prevContent = prevContentRef.current;

    if (nextContent === prevContent) return;

    const shouldReset =
      !prevContent || !nextContent || !nextContent.startsWith(prevContent);

    if (shouldReset) {
      reset(nextContent);
    } else {
      const delta = nextContent.slice(prevContent.length);
      if (delta) {
        addChunk(delta);
      }
    }

    prevContentRef.current = nextContent;
  }, [content, normalize, addChunk, reset]);

  if (!displayedContent) return null;

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {displayedContent}
    </ReactMarkdown>
  );
});

export default StreamingMarkdown;
