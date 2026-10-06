import "server-only";
import type { Message } from "@ag-ui/client";
import type { MastraDBMessage } from "@mastra/core/agent";
import { mastra } from "./mastra";

// Mastra stores a message as parts; the chat shows the text of user and assistant messages.
// Lissie has no tools yet, so there are no tool calls to carry over.
function toChatMessage(message: MastraDBMessage): Message[] {
  const text = message.content.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
  if (!text) return [];
  if (message.role === "user") {
    return [{ id: message.id, role: "user", content: text }];
  }
  if (message.role === "assistant") {
    return [{ id: message.id, role: "assistant", content: text }];
  }
  return [];
}

/** The conversation stored in a Lissie thread, oldest first, as chat messages. */
export async function lissieHistory(threadId: string): Promise<Message[]> {
  const memory = await mastra.getAgent("lissie").getMemory();
  // recall() throws for a thread that does not exist yet, which is every user's first visit.
  const thread = await memory?.getThreadById({ threadId });
  if (!memory || !thread) return [];
  const { messages } = await memory.recall({
    threadId,
    resourceId: thread.resourceId,
    perPage: false,
  });
  return messages.flatMap(toChatMessage);
}
