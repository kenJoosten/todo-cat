// The CopilotKit runtime: serves Lissie to the browser over AG-UI.
import { MastraAgent } from "@ag-ui/mastra";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import { mastra } from "@/lib/lissie/mastra";
import { LissieRunner } from "@/lib/lissie/runner";
import { lissieThreadId } from "@/lib/lissie/thread";
import { guard, lissieAgentId, requestUserId } from "./guard";

const runtime = new CopilotRuntime({
  // Built per request, so memory is scoped to the user from the server-side session.
  // The reserved request-context keys make Mastra itself use that resource and thread,
  // whatever the browser sends.
  agents: async ({ request }) => {
    const userId = await requestUserId(request);
    if (!userId)
      throw Response.json({ error: "Unauthorized" }, { status: 401 });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
    requestContext.set(MASTRA_THREAD_ID_KEY, lissieThreadId(userId));
    return {
      [lissieAgentId]: MastraAgent.getLocalAgent({
        mastra,
        agentId: lissieAgentId,
        resourceId: userId,
        requestContext,
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
