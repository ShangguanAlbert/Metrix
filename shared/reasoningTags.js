const OPEN_REASONING_TAG = "<think>";
const CLOSE_REASONING_TAG = "</think>";

function findTrailingPartialTagLength(text, tags) {
  const source = String(text || "");
  if (!source) return 0;

  let longest = 0;
  tags.forEach((tag) => {
    const safeTag = String(tag || "");
    const maxLength = Math.min(source.length, safeTag.length - 1);
    for (let length = maxLength; length > 0; length -= 1) {
      if (!source.endsWith(safeTag.slice(0, length))) continue;
      longest = Math.max(longest, length);
      break;
    }
  });

  return longest;
}

export function createReasoningTagStreamResolver() {
  let carry = "";
  let inReasoning = false;

  function push(chunk) {
    const source = `${carry}${String(chunk || "")}`;
    let content = "";
    let reasoning = "";
    let cursor = 0;

    carry = "";

    while (cursor < source.length) {
      if (inReasoning) {
        const closeIndex = source.indexOf(CLOSE_REASONING_TAG, cursor);
        if (closeIndex === -1) {
          const remaining = source.slice(cursor);
          const keepLength = findTrailingPartialTagLength(remaining, [
            CLOSE_REASONING_TAG,
          ]);
          const emitUntil = remaining.length - keepLength;
          if (emitUntil > 0) {
            reasoning += remaining.slice(0, emitUntil);
          }
          carry = remaining.slice(emitUntil);
          cursor = source.length;
          continue;
        }

        reasoning += source.slice(cursor, closeIndex);
        inReasoning = false;
        cursor = closeIndex + CLOSE_REASONING_TAG.length;
        continue;
      }

      const openIndex = source.indexOf(OPEN_REASONING_TAG, cursor);
      if (openIndex === -1) {
        const remaining = source.slice(cursor);
        const keepLength = findTrailingPartialTagLength(remaining, [
          OPEN_REASONING_TAG,
        ]);
        const emitUntil = remaining.length - keepLength;
        if (emitUntil > 0) {
          content += remaining.slice(0, emitUntil);
        }
        carry = remaining.slice(emitUntil);
        cursor = source.length;
        continue;
      }

      content += source.slice(cursor, openIndex);
      inReasoning = true;
      cursor = openIndex + OPEN_REASONING_TAG.length;
    }

    return {
      content,
      reasoning,
    };
  }

  function flush() {
    const remaining = carry;
    carry = "";
    const result = inReasoning
      ? { content: "", reasoning: remaining }
      : { content: remaining, reasoning: "" };
    inReasoning = false;
    return result;
  }

  return {
    push,
    flush,
  };
}

export function resolveReasoningTaggedText(text) {
  const resolver = createReasoningTagStreamResolver();
  const first = resolver.push(text);
  const tail = resolver.flush();

  return {
    content: `${first.content}${tail.content}`,
    reasoning: `${first.reasoning}${tail.reasoning}`,
  };
}
