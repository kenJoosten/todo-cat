import "server-only";
import type { Message } from "@ag-ui/client";
import type { MastraDBMessage, MastraMessagePart } from "@mastra/core/agent";
import { mastra } from "./mastra";

type ToolInvocationPart = Extract<
  MastraMessagePart,
  { type: "tool-invocation" }
>;

/**
 * The id of the `index`-th chat message split off a stored message. The bridge's own
 * continuation ids (`MastraAgent.continuationMessageId`, private in @ag-ui/mastra): it
 * recognises them as stored, so the browser resending the replayed history adds nothing
 * to memory. Pinned by a test in the CopilotKit route's tests.
 */
function splitMessageId(storedId: string, index: number) {
  if (index === 0) return storedId;
  return index === 1
    ? `${storedId}-agui-text`
    : `${storedId}-agui-text-${index}`;
}

// One stored assistant message holds its steps as parts, in order: text, tool calls,
// more text. The chat shows each run of text as an assistant message and each run of
// tool calls as an assistant message with `toolCalls`, followed by one tool message per
// result, the way the bridge streams them live (a result's content is its JSON).
function assistantMessages(message: MastraDBMessage): Message[] {
  const messages: Message[] = [];
  let text = "";
  let calls: ToolInvocationPart["toolInvocation"][] = [];
  const id = () => splitMessageId(message.id, messages.length);
  const flushText = () => {
    if (text) messages.push({ id: id(), role: "assistant", content: text });
    text = "";
  };
  const flushCalls = () => {
    if (calls.length === 0) return;
    messages.push({
      id: id(),
      role: "assistant",
      toolCalls: calls.map((call) => ({
        id: call.toolCallId,
        type: "function",
        function: { name: call.toolName, arguments: JSON.stringify(call.args) },
      })),
    });
    for (const call of calls) {
      messages.push({
        id: id(),
        role: "tool",
        toolCallId: call.toolCallId,
        content: JSON.stringify(call.result ?? null),
        ...(call.isError
          ? { error: call.errorText ?? "The tool failed." }
          : {}),
      });
    }
    calls = [];
  };
  for (const part of message.content.parts) {
    if (part.type === "text") {
      flushCalls();
      text += part.text;
    } else if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state === "result"
    ) {
      flushText();
      calls.push(part.toolInvocation);
    }
  }
  flushText();
  flushCalls();
  return messages;
}

// Mastra stores a message as parts; the chat shows the text of user messages, and the
// text and finished tool calls of assistant messages.
function toChatMessages(message: MastraDBMessage): Message[] {
  if (message.role === "assistant") return assistantMessages(message);
  if (message.role !== "user") return [];
  const text = message.content.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
  return text ? [{ id: message.id, role: "user", content: text }] : [];
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
  return messages.flatMap(toChatMessages);
}
