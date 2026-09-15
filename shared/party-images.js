export function findImageSourceAtSelection(html, position) {
  const source = String(html || "");
  // Keep offsets intact while excluding commented-out examples.
  const searchable = source.replace(/<!--[\s\S]*?-->/g, (comment) => " ".repeat(comment.length));
  const tags = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  for (const tag of searchable.matchAll(tags)) {
    if (position < tag.index || position > tag.index + tag[0].length) continue;
    const attribute = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag[0]);
    if (!attribute) return null;
    const quoted = attribute[1].startsWith('"') || attribute[1].startsWith("'");
    const offset = attribute.index + attribute[0].indexOf(attribute[1]);
    const from = tag.index + offset + (quoted ? 1 : 0);
    const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
    return { from, to: from + value.length, value };
  }
  return null;
}

export function parsePartyImagePath(value) {
  const match = /^assets\/([a-f0-9]{24})\.(png|jpg|gif|webp)$/.exec(String(value || ""));
  return match ? { id: match[1], extension: match[2] } : null;
}
