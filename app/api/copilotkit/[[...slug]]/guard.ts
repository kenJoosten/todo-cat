// Authorization for every route the CopilotKit runtime serves. Without CopilotKit
// Intelligence the runtime scopes nothing to a user: its thread routes answer for any
// thread id they are given. So this guard decides, per route, before the runtime runs.
import type { CopilotRuntimeHooks } from "@copilotkit/runtime/v2";
import { getUserId } from "@/lib/auth";
import { currentLissieThreadId } from "@/lib/lissie/conversation";
import { inspectorEnabled } from "@/lib/lissie/inspector";

export const lissieAgentId = "lissie";

const userIds = new WeakMap<Request, Promise<string | null>>();

/** The signed-in user (session cookie or bearer token), looked up once per request. */
export function requestUserId(request: Request): Promise<string | null> {
  let userId = userIds.get(request);
  if (!userId) {
    userId = getUserId(request.headers);
    userIds.set(request, userId);
  }
  return userId;
}

function reject(status: 401 | 404): never {
  const error = status === 401 ? "Unauthorized" : "Not found";
  throw Response.json({ error }, { status });
}

// agent/run and agent/connect name their thread in the JSON body, not the path.
async function bodyThreadId(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.clone().json();
    return typeof body === "object" && body !== null && "threadId" in body
      ? body.threadId
      : undefined;
  } catch {
    return undefined;
  }
}

export const guard: CopilotRuntimeHooks = {
  // Runs before routing, on every request, unknown paths included.
  onRequest: async ({ request }) => {
    if (!(await requestUserId(request))) reject(401);
  },
  // An allowlist: a user reaches Lissie and only their own current thread; everything else
  // is "not found", so the answer never reveals whether another user's thread exists.
  onBeforeHandler: async ({ request, route }) => {
    const userId = await requestUserId(request);
    if (!userId) reject(401);
    const ownThread = await currentLissieThreadId(userId);
    switch (route.method) {
      case "info":
        return;
      // The dev inspector's runtime routes: both Intelligence-only, so with no
      // Intelligence they carry no user data (204 / 404), but stay 404 until the
      // NEXT_PUBLIC_COPILOTKIT_INSPECTOR flag turns the overlay on.
      case "inspector/metadata":
      case "inspector/learning":
        if (!inspectorEnabled) reject(404);
        return;
      case "agent/run":
      case "agent/connect":
        if (
          route.agentId !== lissieAgentId ||
          (await bodyThreadId(request)) !== ownThread
        ) {
          reject(404);
        }
        return;
      case "agent/stop":
        if (route.agentId !== lissieAgentId || route.threadId !== ownThread) {
          reject(404);
        }
        return;
      case "threads/messages":
      case "threads/events":
      case "threads/state":
        if (route.threadId !== ownThread) reject(404);
        return;
      default:
        // Thread lists, clearing and mutations, suggestions, transcription, memories,
        // inspector and debug routes: Lissie's chat uses none of them.
        reject(404);
    }
  },
};
