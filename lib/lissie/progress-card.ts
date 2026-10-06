// The progress card Lissie shows in the chat: an A2UI surface on her catalog
// (lib/lissie/a2ui-catalog.tsx), built by the showProgress tool. The component tree is
// written once, here; the numbers live in the surface's data model and every one of them
// reaches the card through a binding, so the tree is the same for every list.
import type { A2uiMessage } from "@a2ui/web_core/v0_9";
import { lissieCatalogId } from "./a2ui-catalog-id";

/** How far along a user's list is; `total` is `done` plus `open`. */
export type TodoProgress = { total: number; done: number; open: number };

export const progressSurfaceId = "todo-progress";

/** A2UI's placeholder for the value at `path` in the data model, inside a template. */
function value(path: string) {
  return `\${${path}}`;
}

/** A Text's content: `template` with its placeholders filled in from the data model. */
function formatted(template: string) {
  return {
    call: "formatString",
    args: { value: template },
    returnType: "string",
  };
}

const components = [
  { id: "root", component: "Card", child: "body" },
  { id: "body", component: "Column", children: ["summary", "bar", "open"] },
  {
    id: "summary",
    component: "Text",
    text: formatted(`${value("/done")} of ${value("/total")} done`),
  },
  {
    id: "bar",
    component: "ProgressBar",
    value: { path: "/done" },
    max: { path: "/total" },
    label: "Todos done",
  },
  {
    id: "open",
    component: "Text",
    text: formatted(`${value("/open")} still open`),
  },
];

/**
 * The A2UI operations that draw the card for `progress`: create the surface, set its
 * components, then its data. The A2UI middleware finds them under `a2ui_operations` in a
 * tool result and the chat renders the card, with no model call in between.
 */
export function progressCard(progress: TodoProgress) {
  const surfaceId = progressSurfaceId;
  const operations = [
    {
      version: "v0.9",
      createSurface: { surfaceId, catalogId: lissieCatalogId },
    },
    { version: "v0.9", updateComponents: { surfaceId, components } },
    {
      version: "v0.9",
      updateDataModel: { surfaceId, path: "/", value: progress },
    },
  ] satisfies A2uiMessage[];
  return { a2ui_operations: operations };
}
