import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ImagePlaceholderView from "../overlays/ImagePlaceholderView.jsx";

export const NoteImage = Node.create({
  name: "image",

  group: "block",
  draggable: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: "",
      },
      title: {
        default: "",
      },
      align: {
        default: "left",
        parseHTML: (element) =>
          String(element.getAttribute("data-notes-align") || "left").trim() || "left",
        renderHTML: (attributes) => ({
          "data-notes-align": String(attributes.align || "left").trim() || "left",
        }),
      },
      size: {
        default: "medium",
        parseHTML: (element) =>
          String(element.getAttribute("data-notes-size") || "medium").trim() || "medium",
        renderHTML: (attributes) => ({
          "data-notes-size": String(attributes.size || "medium").trim() || "medium",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        class: "notes-rich-editor-image",
      }),
    ];
  },

  addCommands() {
    return {
      setNoteImage:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

export const ImagePlaceholder = Node.create({
  name: "imagePlaceholder",

  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      onRetryUpload: null,
      onRemoveUpload: null,
    };
  },

  addAttributes() {
    return {
      placeholderId: {
        default: "",
      },
      fileName: {
        default: "",
      },
      status: {
        default: "uploading",
      },
      message: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-placeholder"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "image-placeholder",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImagePlaceholderView);
  },

  addCommands() {
    function findPlaceholderEntry(doc, placeholderId) {
      let match = null;
      doc.descendants((node, pos) => {
        if (node.type.name !== "imagePlaceholder") return true;
        if (String(node.attrs?.placeholderId || "").trim() !== placeholderId) return true;
        match = { node, pos };
        return false;
      });
      return match;
    }

    return {
      insertImagePlaceholder:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),

      updateImagePlaceholder:
        (placeholderId, patch = {}) =>
        ({ state, dispatch }) => {
          const safeId = String(placeholderId || "").trim();
          if (!safeId) return false;
          const entry = findPlaceholderEntry(state.doc, safeId);
          if (!entry) return false;

          const tr = state.tr.setNodeMarkup(entry.pos, undefined, {
            ...entry.node.attrs,
            ...patch,
          });
          dispatch?.(tr);
          return true;
        },

      replaceImagePlaceholder:
        (placeholderId, attrs = {}) =>
        ({ state, dispatch }) => {
          const safeId = String(placeholderId || "").trim();
          if (!safeId) return false;
          const entry = findPlaceholderEntry(state.doc, safeId);
          if (!entry) return false;

          const imageNode = state.schema.nodes.image?.create(attrs);
          if (!imageNode) return false;
          const tr = state.tr.replaceWith(
            entry.pos,
            entry.pos + entry.node.nodeSize,
            imageNode,
          );
          dispatch?.(tr);
          return true;
        },

      removeImagePlaceholder:
        (placeholderId) =>
        ({ state, dispatch }) => {
          const safeId = String(placeholderId || "").trim();
          if (!safeId) return false;
          const entry = findPlaceholderEntry(state.doc, safeId);
          if (!entry) return false;

          const tr = state.tr.delete(entry.pos, entry.pos + entry.node.nodeSize);
          dispatch?.(tr);
          return true;
        },
    };
  },
});
