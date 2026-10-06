import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { expect, test } from "vitest";
import { lissieCatalog } from "./a2ui-catalog";
import { progressCard, progressSurfaceId } from "./progress-card";

function Operations({ operations }: { operations: Record<string, unknown>[] }) {
  const { processMessages } = useA2UIActions();
  useEffect(() => processMessages(operations), [processMessages, operations]);
  return null;
}

// The card as the chat draws it: the tool's operations, through Lissie's catalog.
function renderCard(progress: Parameters<typeof progressCard>[0]) {
  const { a2ui_operations } = progressCard(progress);
  render(
    <A2UIProvider catalog={lissieCatalog}>
      <Operations operations={a2ui_operations} />
      <A2UIRenderer surfaceId={progressSurfaceId} />
    </A2UIProvider>,
  );
}

test("the ProgressBar gets its numbers from the data model", async () => {
  renderCard({ total: 5, done: 3, open: 2 });
  const bar = await screen.findByRole("progressbar", { name: "Todos done" });
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuemax")).toBe("5");
  expect(await screen.findByText("3 of 5 done")).toBeTruthy();
  expect(screen.getByText("2 still open")).toBeTruthy();
});

test("an empty list draws an empty bar", async () => {
  renderCard({ total: 0, done: 0, open: 0 });
  const bar = await screen.findByRole("progressbar", { name: "Todos done" });
  expect(bar.getAttribute("aria-valuenow")).toBe("0");
  expect(await screen.findByText("0 of 0 done")).toBeTruthy();
});
