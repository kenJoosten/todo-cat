// The CopilotKit runtime: serves Lissie to the browser over AG-UI.
import { MastraAgent } from "@ag-ui/mastra";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
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
      [lissieAgentId]: MastraAgent.getLocalAgent({
        mastra,
        agentId: lissieAgentId,
        resourceId: userId,
        requestContext: lissieRequestContext(userId),
      }),
    };
  },
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
