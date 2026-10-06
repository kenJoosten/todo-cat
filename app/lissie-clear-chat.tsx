"use client";

import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { FormError } from "@/components/ui/form-error";
import { clearLissieChatAction } from "./lissie-actions";

/**
 * Inside the chat's CopilotKit provider: clears the conversation with Lissie, after asking.
 * The server starts a new thread and the page hands the chat its id; the chat keeps showing
 * the old messages until they are dropped here. Off while she replies, so no run is cut off.
 */
export function ClearChat({ agentId }: { agentId: string }) {
  const { agent } = useAgent({
    agentId,
    updates: [
      UseAgentUpdate.OnMessagesChanged,
      UseAgentUpdate.OnRunStatusChanged,
    ],
  });
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const clearRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  const cleared = useRef(false);

  // Clear chat gets focus back after Keep; after clearing it is off, so the chat's input
  // takes focus instead, ready for a fresh start.
  useEffect(() => {
    if (!confirming && asked.current) {
      const input = document.querySelector<HTMLElement>(
        '.lissie-chat [data-testid="copilot-chat-textarea"]',
      );
      (cleared.current ? input : clearRef.current)?.focus();
      cleared.current = false;
    }
    asked.current = confirming;
  }, [confirming]);

  const clear = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await clearLissieChatAction();
      if (result.error) {
        setError(result.error);
      } else {
        agent.setMessages([]);
        cleared.current = true;
      }
      setConfirming(false);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <Confirm
          question="Clear the chat? Lissie forgets it too."
          action="Clear"
          pending={pending}
          onConfirm={clear}
          onKeep={() => setConfirming(false)}
        />
      ) : (
        <Button
          ref={clearRef}
          variant="quiet"
          size="small"
          disabled={agent.messages.length === 0 || agent.isRunning}
          onClick={() => setConfirming(true)}
        >
          Clear chat
        </Button>
      )}
      <FormError message={error} />
    </div>
  );
}
