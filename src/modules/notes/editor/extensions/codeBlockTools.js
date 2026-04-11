import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const codeBlockToolsPluginKey = new PluginKey("notesCodeBlockTools");

function createCopyButton(code = "") {
  const wrapper = document.createElement("span");
  wrapper.className = "notes-code-block-toolbar";
  wrapper.setAttribute("contenteditable", "false");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "notes-code-block-copy-btn";
  button.textContent = "复制";

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = String(code || "");
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore copy failures
    }
  });

  wrapper.appendChild(button);
  return wrapper;
}

export const CodeBlockTools = Extension.create({
  name: "codeBlockTools",

  addOptions() {
    return {
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    const enabled = !!this.options.enabled;

    return [
      new Plugin({
        key: codeBlockToolsPluginKey,
        props: {
          decorations: (state) => {
            if (!enabled) return null;

            const decorations = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock") return true;

              decorations.push(
                Decoration.widget(
                  pos + 1,
                  () => createCopyButton(node.textContent || ""),
                  {
                    side: -1,
                    ignoreSelection: true,
                  },
                ),
              );

              return false;
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
