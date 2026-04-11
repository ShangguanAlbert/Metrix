export function buildTocItemsFromDoc(doc, activePos = 0) {
  if (!doc) return [];

  const headings = [];
  doc.descendants((node, pos) => {
    if (node?.type?.name !== "heading") return true;
    const depth = Number(node.attrs?.level || 1);
    if (depth < 1 || depth > 3) return true;
    headings.push({
      id: String(node.attrs?.anchorId || "").trim(),
      text: String(node.textContent || "").trim() || `标题 ${headings.length + 1}`,
      depth,
      pos,
    });
    return true;
  });

  if (headings.length === 0) return headings;

  let activeIndex = headings.findLastIndex((item) => activePos >= item.pos);
  if (activeIndex < 0) activeIndex = 0;

  return headings.map((item, index) => ({
    ...item,
    isActive: index === activeIndex,
  }));
}
