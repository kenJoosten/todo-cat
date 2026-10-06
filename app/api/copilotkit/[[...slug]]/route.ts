// The CopilotKit runtime: serves Lissie to the browser over AG-UI.
import { MastraAgent } from "@ag-ui/mastra";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { currentLissieThreadId } from "@/lib/lissie/conversation";
import { mastra } from "@/lib/lissie/mastra";
import { lissieRequestContext } from "@/lib/lissie/request-context";
import { LissieRunner } from "@/lib/lissie/runner";
import { guard, lissieAgentId, requestUserId } from "./guard";

const runtime = new CopilotRuntime({
  // Built per request, so memory and tools are scoped to the user from the server-side
  // session: the request context carries that user to Mastra's memory and to every tool,
  // whatever the browser sends.
  agents: async ({ request }) => {
    const userId = await requestUserId(request);
    if (!userId)
      throw Response.json({ error: "Unauthorized" }, { status: 401 });
    return {
      [lissieAgentId]: new MastraAgent({
        agentId: lissieAgentId,
        agent: mastra.getAgent(lissieAgentId),
        resourceId: userId,
        requestContext: lissieRequestContext(
          userId,
          await currentLissieThreadId(userId),
        ),
        // The bridge would add a UI-generating tool when a run's forwarded props, which
        // the browser sends, ask for one; Lissie's cards come only from her own tools.
        a2ui: { injectA2UITool: false },
      }),
    };
  },
  // The A2UI middleware turns `a2ui_operations` in a tool result into a card in the chat
  // (lib/lissie/progress-card.ts). No generated surfaces: it injects no render tool.
  a2ui: { agents: [lissieAgentId], injectA2UITool: false },
  runner: new LissieRunner(),
  // The runtime forwards `authorization` and `x-*` request headers to the agent, and the
  // Mastra bridge passes them on to the model call: a bearer token would reach OpenRouter.
  // Lissie needs none of them.
  forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  hooks: guard,
});

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST };
