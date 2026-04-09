import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

function stripHtml(value = "") {
  return String(value || "").replace(/<[^>]+>/g, "");
}

function sanitizeFilename(value = "") {
  const base = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return base || "笔记";
}

function getHeadingLevel(depth = 1) {
  if (depth === 1) return HeadingLevel.HEADING_1;
  if (depth === 2) return HeadingLevel.HEADING_2;
  if (depth === 3) return HeadingLevel.HEADING_3;
  if (depth === 4) return HeadingLevel.HEADING_4;
  if (depth === 5) return HeadingLevel.HEADING_5;
  return HeadingLevel.HEADING_6;
}

function extractText(node) {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return String(node.value || "");
  if (node.type === "break") return "\n";
  if (node.type === "html") return stripHtml(node.value);
  if (Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child)).join("");
  }
  return "";
}

function normalizePlainText(value = "") {
  return String(value || "").replace(/\r/g, "").trim();
}

function hasExportableText(markdown = "") {
  const normalized = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\(([^)]*)\)/g, " ")
    .replace(/[#>*_\-~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Boolean(normalized);
}

function createTextRun(text, style = {}) {
  return new TextRun({
    text: String(text || ""),
    bold: Boolean(style.bold),
    italics: Boolean(style.italics),
    strike: Boolean(style.strike),
    underline: style.underline ? {} : undefined,
    font: style.font,
    size: style.size,
    color: style.color,
  });
}

function mergeInlineStyle(style = {}, next = {}) {
  return {
    ...style,
    ...next,
    bold: Boolean(style.bold || next.bold),
    italics: Boolean(style.italics || next.italics),
    strike: Boolean(style.strike || next.strike),
    underline: Boolean(style.underline || next.underline),
    font: next.font || style.font,
    size: next.size || style.size,
    color: next.color || style.color,
  };
}

function inlineNodesToRuns(nodes = [], style = {}) {
  const runs = [];

  nodes.forEach((node) => {
    if (!node) return;

    if (node.type === "text") {
      const value = String(node.value || "");
      if (value) runs.push(createTextRun(value, style));
      return;
    }

    if (node.type === "break") {
      runs.push(new TextRun({ break: 1 }));
      return;
    }

    if (node.type === "inlineCode") {
      runs.push(
        createTextRun(String(node.value || ""), mergeInlineStyle(style, {
          font: "Menlo",
          size: 20,
        })),
      );
      return;
    }

    if (node.type === "strong") {
      runs.push(...inlineNodesToRuns(node.children, mergeInlineStyle(style, { bold: true })));
      return;
    }

    if (node.type === "emphasis") {
      runs.push(...inlineNodesToRuns(node.children, mergeInlineStyle(style, { italics: true })));
      return;
    }

    if (node.type === "delete") {
      runs.push(...inlineNodesToRuns(node.children, mergeInlineStyle(style, { strike: true })));
      return;
    }

    if (node.type === "link") {
      const label = extractText(node).trim() || String(node.url || "");
      if (!label) return;
      runs.push(
        new ExternalHyperlink({
          link: String(node.url || "").trim(),
          children: [
            createTextRun(label, mergeInlineStyle(style, {
              color: "1D4ED8",
              underline: true,
            })),
          ],
        }),
      );
      return;
    }

    if (node.type === "html") {
      const raw = String(node.value || "").trim();
      const underlineMatch = raw.match(/^<u>([\s\S]*)<\/u>$/i);
      if (underlineMatch) {
        const value = stripHtml(underlineMatch[1]).trim();
        if (value) {
          runs.push(createTextRun(value, mergeInlineStyle(style, { underline: true })));
        }
        return;
      }
      const value = stripHtml(raw);
      if (value) runs.push(createTextRun(value, style));
      return;
    }

    if (Array.isArray(node.children)) {
      runs.push(...inlineNodesToRuns(node.children, style));
    }
  });

  return runs;
}

function blockNodeToParagraphs(node, options = {}) {
  if (!node) return [];
  const depth = options.depth || 0;

  if (node.type === "paragraph") {
    const runs = inlineNodesToRuns(node.children);
    return [
      new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun("")],
        spacing: { after: 160 },
      }),
    ];
  }

  if (node.type === "heading") {
    const runs = inlineNodesToRuns(node.children);
    return [
      new Paragraph({
        heading: getHeadingLevel(node.depth),
        children: runs.length > 0 ? runs : [new TextRun("")],
        spacing: { before: 240, after: 120 },
      }),
    ];
  }

  if (node.type === "blockquote") {
    return (node.children || []).flatMap((child) => {
      const text = normalizePlainText(extractText(child));
      if (!text) return [];
      return [
        new Paragraph({
          children: [createTextRun(text, { italics: true, color: "6B5442" })],
          indent: { left: 480 },
          border: {
            left: {
              color: "C8A987",
              size: 12,
              space: 12,
            },
          },
          spacing: { after: 120 },
        }),
      ];
    });
  }

  if (node.type === "code") {
    const lines = String(node.value || "").replace(/\r/g, "").split("\n");
    const effectiveLines = lines.length > 0 ? lines : [""];
    return effectiveLines.map(
      (line, index) =>
        new Paragraph({
          children: [
            new TextRun({
              text: line || " ",
              font: "Menlo",
              size: 20,
              color: "3D3127",
            }),
          ],
          shading: {
            color: "auto",
            fill: "F4EDE2",
          },
          indent: { left: 320, right: 120 },
          spacing: {
            before: index === 0 ? 160 : 0,
            after: index === effectiveLines.length - 1 ? 160 : 0,
          },
        }),
    );
  }

  if (node.type === "list") {
    return (node.children || []).flatMap((item, itemIndex) => {
      const itemBlocks = Array.isArray(item.children) ? item.children : [];
      const firstParagraphNode = itemBlocks.find((child) => child?.type === "paragraph");
      const firstRuns =
        firstParagraphNode?.type === "paragraph"
          ? inlineNodesToRuns(firstParagraphNode.children)
          : [createTextRun(extractText(item).trim(), {})];
      const prefix = node.ordered ? `${itemIndex + 1}. ` : "• ";
      const nestedBlocks = itemBlocks.filter((child) => child !== firstParagraphNode);

      return [
        new Paragraph({
          children: [createTextRun(prefix, { bold: true }), ...(firstRuns.length > 0 ? firstRuns : [new TextRun("")])],
          indent: { left: depth * 360 + 240, hanging: 120 },
          spacing: { after: 80 },
        }),
        ...nestedBlocks.flatMap((child) => blockNodeToParagraphs(child, { depth: depth + 1 })),
      ];
    });
  }

  if (node.type === "table") {
    const rows = (node.children || []).map((row, rowIndex) => {
      const cells = (row.children || []).map((cell) => {
        const paragraphs = (cell.children || []).flatMap((child) => blockNodeToParagraphs(child, { depth }));
        return new TableCell({
          width: { size: 100 / Math.max(row.children?.length || 1, 1), type: WidthType.PERCENTAGE },
          shading: rowIndex === 0 ? { color: "auto", fill: "EFE3D6" } : undefined,
          children:
            paragraphs.length > 0
              ? paragraphs
              : [
                  new Paragraph({
                    children: [new TextRun("")],
                  }),
                ],
        });
      });
      return new TableRow({ children: cells });
    });

    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      }),
      new Paragraph({ spacing: { after: 160 } }),
    ];
  }

  if (node.type === "thematicBreak") {
    return [
      new Paragraph({
        border: {
          bottom: {
            color: "D7C2AA",
            size: 6,
            space: 1,
          },
        },
        spacing: { before: 120, after: 120 },
      }),
    ];
  }

  if (Array.isArray(node.children)) {
    return node.children.flatMap((child) => blockNodeToParagraphs(child, { depth }));
  }

  const fallbackText = normalizePlainText(extractText(node));
  if (!fallbackText) return [];
  return [
    new Paragraph({
      children: [createTextRun(fallbackText, {})],
      spacing: { after: 160 },
    }),
  ];
}

export async function exportNoteMarkdownToWord({ title = "", markdown = "" } = {}) {
  if (!hasExportableText(markdown)) {
    const error = new Error("笔记暂无内容，无法导出 Word。");
    error.statusCode = 400;
    throw error;
  }

  const tree = unified().use(remarkParse).use(remarkGfm).parse(String(markdown || ""));
  const children = Array.isArray(tree?.children)
    ? tree.children.flatMap((node) => blockNodeToParagraphs(node))
    : [];

  const doc = new Document({
    creator: "EduChat",
    title: sanitizeFilename(title),
    description: "EduChat 笔记导出",
    sections: [
      {
        properties: {},
        children:
          children.length > 0
            ? children
            : [
                new Paragraph({
                  children: [new TextRun("")],
                }),
              ],
      },
    ],
  });

  return {
    filename: `${sanitizeFilename(title)}.docx`,
    buffer: await Packer.toBuffer(doc),
  };
}
