import "server-only";
import { randomUUID } from "node:crypto";
import { mastra } from "./mastra";
import { lissieThreadId } from "./thread";

function lissieMemory() {
  return mastra.getAgent("lissie").getMemory();
}

/**
 * The thread of the user's conversation with Lissie: their one thread in Mastra memory, or
 * `lissieThreadId` before they have one. Clearing the chat replaces it with a new thread.
 */
export async function currentLissieThreadId(userId: string): Promise<string> {
  const memory = await lissieMemory();
  const page = await memory?.listThreads({
    filter: { resourceId: userId },
    orderBy: { field: "createdAt", direction: "DESC" },
    perPage: 1,
  });
  return page?.threads[0]?.id ?? lissieThreadId(userId);
}

/**
 * Starts the user's conversation with Lissie over: a new, empty thread becomes current, and
 * the old one is deleted from memory, so she forgets it. A new thread id rather than an
 * emptied one, because CopilotKit's in-memory runner keeps every thread's past runs and
 * replays them to a reconnect during a run; nothing addresses the old id again.
 */
export async function clearLissieConversation(userId: string): Promise<void> {
  const memory = await lissieMemory();
  if (!memory) throw new Error("Lissie has no memory to clear.");
  const old = await currentLissieThreadId(userId);
  await memory.createThread({
    resourceId: userId,
    threadId: `${lissieThreadId(userId)}-${randomUUID()}`,
  });
  await memory.deleteThread(old);
}
