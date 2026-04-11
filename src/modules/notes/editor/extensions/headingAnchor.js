import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createEditorStableId } from "../utils/editorIds.js";

const headingAnchorPluginKey = new PluginKey("notes-heading-anchor");

function ensureUniqueAnchorIds(doc, tr) {
  const seenIds = new Set();
  let changed = false;

  doc.descendants((node, pos) => {
    if (node?.type?.name !== "heading") return true;

    const currentId = String(node.attrs?.anchorId || "").trim();
    const nextId =
      !currentId || seenIds.has(currentId)
        ? createEditorStableId("heading")
        : currentId;

    seenIds.add(nextId);

    if (nextId !== currentId) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        anchorId: nextId,
      });
      changed = true;
    }

    return true;
  });

  return changed;
}

export const HeadingAnchor = Extension.create({
  name: "notesHeadingAnchor",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          anchorId: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-notes-heading-id") ||
              element.getAttribute("id") ||
              null,
            renderHTML: (attributes) => {
              if (!attributes.anchorId) return {};
              return {
                id: attributes.anchorId,
                "data-notes-heading-id": attributes.anchorId,
              };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: headingAnchorPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          const tr = newState.tr;
          const changed = ensureUniqueAnchorIds(newState.doc, tr);
          return changed ? tr : null;
        },
      }),
    ];
  },
});
