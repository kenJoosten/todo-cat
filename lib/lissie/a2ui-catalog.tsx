// Lissie's A2UI catalog: the components her tools' cards are built from. The basic catalog
// (Text, Row, Column, ...) plus a ProgressBar, and a Card drawn in the app's palette.
// The renderers get props with every data binding already resolved against the surface's
// data model.

import { CardApi, SliderApi } from "@a2ui/web_core/v0_9/basic_catalog";
import {
  basicCatalog,
  Catalog,
  createReactComponent,
  DynamicNumberSchema,
  DynamicStringSchema,
} from "@copilotkit/a2ui-renderer";
import { ProgressBar } from "@/components/ui/progress-bar";
import { lissieCatalogId } from "./a2ui-catalog-id";

// A2UI's binder finds bindable props by reading zod 3 schemas, and A2UI keeps its own copy
// of zod 3 apart from the app's zod 4; TypeScript can't relate schemas across the copies.
// So new props are built from A2UI's own schemas: a read-only slider's common props and
// value, plus a bindable max and a label.
const progressBarApi = {
  name: "ProgressBar",
  schema: SliderApi.schema
    .pick({ accessibility: true, weight: true, value: true })
    .extend({
      max: DynamicNumberSchema.describe("The value at which the bar is full."),
      label: DynamicStringSchema.describe("The bar's accessible name."),
    })
    .strict(),
};

const progressBar = createReactComponent(progressBarApi, ({ props }) => (
  <div className="m-2">
    <ProgressBar value={props.value} max={props.max} label={props.label} />
  </div>
));

// The basic Card is white with a grey border whatever the color scheme; this one is a tray
// of the page's ground inside the chat panel, not raised, with the Text margins as padding.
const card = createReactComponent(CardApi, ({ props, buildChild }) => (
  <div className="w-full rounded-lg border border-line bg-ground p-2 text-ink">
    {buildChild(props.child)}
  </div>
));

/** The catalog the chat registers; a component listed later replaces a basic one. */
export const lissieCatalog = new Catalog(
  lissieCatalogId,
  [...basicCatalog.components.values(), card, progressBar],
  [...basicCatalog.functions.values()],
);
