import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Highlights placeholders like [TENANT'S ADDRESS] in the editor (display only: the document text is not changed). The look is the .draft-placeholder class in globals.css.
const RE = /\[[A-Z][A-Z0-9 '’/&.,:-]{2,80}\]/g;
export const PlaceholderHighlight = Extension.create({
  name: "placeholderHighlight",
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey("placeholderHighlight"),
      props: {
        decorations(state) {
          const decos: Decoration[] = [];
          state.doc.descendants((node, pos) => { if (!node.isText || !node.text) return; for (const m of node.text.matchAll(RE)) decos.push(Decoration.inline(pos + m.index!, pos + m.index! + m[0].length, { class: "draft-placeholder" })); });
          return DecorationSet.create(state.doc, decos);
        },
      },
    })];
  },
});
