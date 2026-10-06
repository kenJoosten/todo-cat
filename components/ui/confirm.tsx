"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { Button } from "./button";

// Asks before something that can't be undone, in place of the button that started it: the
// question, the danger action, and Keep. Keep takes focus, and Escape keeps too; the caller
// puts focus back on its own button when the question goes away.
export function Confirm({
  question,
  action,
  onConfirm,
  onKeep,
  pending = false,
}: {
  question: ReactNode;
  action: ReactNode;
  onConfirm: () => void;
  onKeep: () => void;
  pending?: boolean;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => keepRef.current?.focus(), []);

  const escapeKeeps = (event: KeyboardEvent) => {
    if (event.key === "Escape") onKeep();
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-muted">{question}</span>
      <Button
        variant="danger"
        size="small"
        disabled={pending}
        onClick={onConfirm}
        onKeyDown={escapeKeeps}
      >
        {action}
      </Button>
      <Button
        ref={keepRef}
        variant="secondary"
        size="small"
        disabled={pending}
        onClick={onKeep}
        onKeyDown={escapeKeeps}
      >
        Keep
      </Button>
    </div>
  );
}
