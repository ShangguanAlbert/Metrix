function isSameMark(left, right) {
  if (!left || !right) return false;
  if (left.type?.name !== right.type?.name) return false;
  return JSON.stringify(left.attrs || {}) === JSON.stringify(right.attrs || {});
}

export function findMarkRangeAtPos(doc, pos, markTypeName = "link") {
  if (!doc) return null;
  const textNodes = [];

  doc.descendants((node, nodePos) => {
    if (!node?.isText) return true;
    const mark = Array.isArray(node.marks)
      ? node.marks.find((item) => item?.type?.name === markTypeName)
      : null;
    if (!mark) return true;
    textNodes.push({
      from: nodePos,
      to: nodePos + node.nodeSize,
      mark,
      text: node.text || "",
    });
    return true;
  });

  if (textNodes.length === 0) return null;

  const normalizedPos = Math.max(0, Math.min(Number(pos) || 0, doc.content.size));
  const currentIndex = textNodes.findIndex(
    (item) => normalizedPos >= item.from && normalizedPos <= item.to,
  );
  if (currentIndex < 0) return null;

  let startIndex = currentIndex;
  let endIndex = currentIndex;

  while (
    startIndex > 0 &&
    textNodes[startIndex - 1].to === textNodes[startIndex].from &&
    isSameMark(textNodes[startIndex - 1].mark, textNodes[startIndex].mark)
  ) {
    startIndex -= 1;
  }

  while (
    endIndex < textNodes.length - 1 &&
    textNodes[endIndex].to === textNodes[endIndex + 1].from &&
    isSameMark(textNodes[endIndex].mark, textNodes[endIndex + 1].mark)
  ) {
    endIndex += 1;
  }

  const from = textNodes[startIndex].from;
  const to = textNodes[endIndex].to;
  const text = textNodes.slice(startIndex, endIndex + 1).map((item) => item.text).join("");

  return {
    from,
    to,
    text,
    mark: textNodes[currentIndex].mark,
  };
}

export function getEditorRectForRange(editor, range = null) {
  if (!editor?.view) return null;

  if (
    typeof window !== "undefined" &&
    window.getSelection &&
    !range
  ) {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect?.width || rect?.height) {
        return rect;
      }
    }
  }

  const from = Math.max(0, Number(range?.from ?? editor.state.selection.from) || 0);
  const to = Math.max(from, Number(range?.to ?? editor.state.selection.to) || from);

  try {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    return new DOMRect(
      start.left,
      Math.min(start.top, end.top),
      Math.max(36, end.right - start.left),
      Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top),
    );
  } catch {
    return null;
  }
}
