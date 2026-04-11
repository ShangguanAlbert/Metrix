import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const turndownService = new TurndownService({
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  headingStyle: "atx",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndownService.use(gfm);
turndownService.addRule("ignoreImagePlaceholders", {
  filter: (node) =>
    node.nodeName === "DIV" &&
    typeof node.getAttribute === "function" &&
    node.getAttribute("data-type") === "image-placeholder",
  replacement: () => "",
});

function escapeHtmlAttribute(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeMarkdownImageAlt(value = "") {
  return String(value || "").replace(/[[\]\\]/g, "\\$&");
}

function escapeMarkdownTitle(value = "") {
  return String(value || "").replace(/"/g, '\\"');
}

turndownService.addRule("noteImages", {
  filter: (node) => node.nodeName === "IMG",
  replacement: (_content, node) => {
    if (typeof node.getAttribute !== "function") return "";

    const src = String(node.getAttribute("src") || "").trim();
    if (!src) return "";

    const alt = String(node.getAttribute("alt") || "").trim();
    const title = String(node.getAttribute("title") || "").trim();
    const align = String(node.getAttribute("data-notes-align") || "left").trim() || "left";
    const size = String(node.getAttribute("data-notes-size") || "medium").trim() || "medium";
    const isDefaultAlign = align === "left";
    const isDefaultSize = size === "medium";

    if (isDefaultAlign && isDefaultSize) {
      const titleSuffix = title ? ` "${escapeMarkdownTitle(title)}"` : "";
      return `![${escapeMarkdownImageAlt(alt)}](${src}${titleSuffix})`;
    }

    const titleAttr = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
    return `\n\n<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt)}"${titleAttr} data-notes-align="${escapeHtmlAttribute(align)}" data-notes-size="${escapeHtmlAttribute(size)}" />\n\n`;
  },
});

function normalizeLineEndings(value = "") {
  return String(value || "").replace(/\r\n?/g, "\n");
}

export function normalizeMarkdown(value = "") {
  return normalizeLineEndings(value)
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function markdownToHtml(markdown = "") {
  const normalized = normalizeLineEndings(markdown);
  if (!normalized.trim()) return "<p></p>";
  return marked.parse(normalized);
}

export function htmlToMarkdown(html = "") {
  const normalizedHtml = String(html || "").trim();
  if (!normalizedHtml) return "";
  return normalizeMarkdown(turndownService.turndown(normalizedHtml));
}
