import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const activeBlockHighlightPluginKey = new PluginKey("notesActiveBlockHighlight");

function getActiveTextblockRange(selection) {
  if (!(selection instanceof TextSelection)) return null;

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (!node?.isTextblock) continue;
    if (node.type?.name === "codeBlock") return null;

    return {
      from: $from.before(depth),
      to: $from.after(depth),
    };
  }

  return null;
}

export const ActiveBlockHighlight = Extension.create({
  name: "activeBlockHighlight",

  addOptions() {
    return {
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    const enabled = !!this.options.enabled;

    return [
      new Plugin({
        key: activeBlockHighlightPluginKey,
        props: {
          decorations: (state) => {
            if (!enabled) return null;

            const range = getActiveTextblockRange(state.selection);
            if (!range) return null;

            return DecorationSet.create(state.doc, [
              Decoration.node(range.from, range.to, {
                class: "notes-active-block",
              }),
            ]);
          },
        },
      }),
    ];
  },
});
