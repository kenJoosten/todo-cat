"use client";

import { useAgent, useRenderTool } from "@copilotkit/react-core/v2";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { todoWriteToolNames } from "@/lib/lissie/todo-tool-schemas";
import { type ToolCallLine, toolCallLine } from "@/lib/lissie/tool-call-line";

/** What CopilotKit hands a tool-call renderer; `result` is set once the call is complete. */
type ToolCallRenderProps = {
  name: string;
  parameters: unknown;
  status: "inProgress" | "executing" | "complete";
  result?: string;
};

const marks: Record<
  ToolCallLine["state"],
  { mark: string; className: string }
> = {
  running: { mark: "…", className: "animate-pulse text-amber-deep" },
  done: { mark: "✓", className: "text-ink" },
  failed: { mark: "✕", className: "text-danger" },
};

function ToolCallRow({
  name,
  parameters,
  status,
  result,
}: ToolCallRenderProps) {
  const line = toolCallLine(
    name,
    parameters,
    status === "complete" ? result : undefined,
  );
  const { mark, className } = marks[line.state];
  return (
    <p
      className="my-1 flex items-baseline gap-2 text-sm text-muted"
      data-state={line.state}
    >
      <span aria-hidden className={`w-3 shrink-0 text-center ${className}`}>
        {mark}
      </span>
      <span>{line.text}</span>
    </p>
  );
}

/**
 * Inside the chat's CopilotKit provider: draws each of Lissie's tool calls as one line,
 * live and in the replayed history alike, and refreshes the page's server data (and so the
 * sidebar) whenever a call that changes the list comes back.
 */
export function LissieToolCalls({ agentId }: { agentId: string }) {
  useRenderTool(
    { name: "*", agentId, render: (props) => <ToolCallRow {...props} /> },
    [agentId],
  );

  const router = useRouter();
  // No updates: this component only listens, it never needs to re-render with the chat.
  const { agent, isReady } = useAgent({ agentId, updates: [] });
  useEffect(() => {
    if (!isReady) return;
    const writes = new Set<string>();
    const { unsubscribe } = agent.subscribe({
      onToolCallStartEvent: ({ event }) => {
        if (todoWriteToolNames.some((name) => name === event.toolCallName)) {
          writes.add(event.toolCallId);
        }
      },
      onToolCallResultEvent: ({ event }) => {
        if (writes.delete(event.toolCallId)) router.refresh();
      },
    });
    return unsubscribe;
  }, [agent, isReady, router]);

  return null;
}
