import "server-only";
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import { lissieThreadId } from "./thread";

/**
 * The request-context key Lissie's tools read the signed-in user's id from. Only the
 * server sets it, from the session; the AG-UI bridge puts what the browser sends under
 * its own `ag-ui` key, so the browser cannot reach this one, and neither can the model.
 */
export const userIdKey = "todo-cat.user-id";

/**
 * The context for one run of Lissie on behalf of `userId`, who comes from `getUserId`.
 * Mastra prefers its reserved resource and thread keys over anything in the run input,
 * so memory is that user's; the tools take the owner of every todo from `userIdKey`.
 */
export function lissieRequestContext(userId: string): RequestContext {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  requestContext.set(MASTRA_THREAD_ID_KEY, lissieThreadId(userId));
  requestContext.set(userIdKey, userId);
  return requestContext;
}
