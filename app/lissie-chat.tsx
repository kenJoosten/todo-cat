"use client";

import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { inspectorEnabled } from "@/lib/lissie/inspector";
import "./lissie-chat.css";
import { LissieToolCalls } from "./lissie-tool-calls";

const labels = {
  modalHeaderTitle: "Lissie",
  chatInputPlaceholder: "Tell Lissie about your list",
  chatDisclaimerText:
    "Lissie is a cat, and an AI. She changes your list when you ask; check what she did.",
};

// The chat with Lissie. The thread id comes from the server (one thread per user), and
// the runtime at /api/copilotkit only accepts that thread for the signed-in user.
// An explicit thread id makes the chat replay its history, and turns off the welcome screen.
export function LissieChat({ threadId }: { threadId: string }) {
  return (
    <div className="lissie-chat h-[32rem] overflow-hidden rounded-md border border-line bg-white/60">
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        useSingleEndpoint={false}
        enableInspector={inspectorEnabled}
      >
        <LissieToolCalls agentId="lissie" />
        <CopilotChat agentId="lissie" threadId={threadId} labels={labels} />
      </CopilotKit>
    </div>
  );
}
