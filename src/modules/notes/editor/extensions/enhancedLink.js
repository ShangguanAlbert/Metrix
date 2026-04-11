import Link from "@tiptap/extension-link";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const linkEditorPluginKey = new PluginKey("notes-link-editor");

export const EnhancedLink = Link.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      editable: true,
      onLinkClick: null,
    };
  },

  addProseMirrorPlugins() {
    const basePlugins = this.parent?.() || [];

    return [
      ...basePlugins,
      new Plugin({
        key: linkEditorPluginKey,
        props: {
          handleClick: (view, pos, event) => {
            if (!this.options.editable) return false;
            const target =
              event?.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!target) return false;

            event.preventDefault();
            event.stopPropagation();

            const href = String(target.getAttribute("href") || "").trim();
            if (!href) return true;

            window.open(href, "_blank", "noopener,noreferrer");
            return true;
          },
        },
      }),
    ];
  },
});
