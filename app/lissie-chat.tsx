"use client";

import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { ReactNode } from "react";
import { inspectorEnabled } from "@/lib/lissie/inspector";
import "./lissie-chat.css";
import { ClearChat } from "./lissie-clear-chat";
import { LissieToolCalls } from "./lissie-tool-calls";

const labels = {
  modalHeaderTitle: "Lissie",
  chatInputPlaceholder: "Tell Lissie about your list",
  chatDisclaimerText:
    "Lissie is a cat, and an AI. She changes your list when you ask; check what she did.",
};

// The chat with Lissie, under its heading with the button that clears it. The thread id
// comes from the server (the user's current thread), and the runtime at /api/copilotkit
// only accepts that thread for the signed-in user.
// An explicit thread id makes the chat replay its history, and turns off the welcome screen.
export function LissieChat({
  threadId,
  heading,
}: {
  threadId: string;
  heading: ReactNode;
}) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      enableInspector={inspectorEnabled}
    >
      <LissieToolCalls agentId="lissie" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {heading}
          <ClearChat agentId="lissie" />
        </div>
        <div className="lissie-chat h-[34rem] overflow-hidden rounded-lg border border-line bg-surface lg:h-[calc(100dvh-9rem)] lg:max-h-[48rem]">
          <CopilotChat agentId="lissie" threadId={threadId} labels={labels} />
        </div>
      </div>
    </CopilotKit>
  );
}
