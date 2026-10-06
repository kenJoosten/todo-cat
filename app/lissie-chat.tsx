"use client";

import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import "./lissie-chat.css";

const labels = {
  modalHeaderTitle: "Lissie",
  chatInputPlaceholder: "Tell Lissie about your list",
  chatDisclaimerText:
    "Lissie is a cat, and an AI. She can't see or change your list yet.",
};

// The chat with Lissie. The thread id comes from the server (one thread per user), and
// the runtime at /api/copilotkit only accepts that thread for the signed-in user.
// An explicit thread id makes the chat replay its history, and turns off the welcome screen.
export function LissieChat({ threadId }: { threadId: string }) {
  return (
    <div className="lissie-chat mt-10 h-[32rem] overflow-hidden rounded-md border border-line bg-white/60">
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        useSingleEndpoint={false}
        enableInspector={false}
      >
        <CopilotChat agentId="lissie" threadId={threadId} labels={labels} />
      </CopilotKit>
    </div>
  );
}
