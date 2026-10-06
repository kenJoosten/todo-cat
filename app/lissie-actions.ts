"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getUserId } from "@/lib/auth";
import { clearLissieConversation } from "@/lib/lissie/conversation";

/** Nothing on success; a message for the user when the chat wasn't cleared. */
export type ClearChatResult = { error?: string };

// Clears the signed-in user's conversation with Lissie, then refreshes the page, which hands
// the chat the new thread's id.
export async function clearLissieChatAction(): Promise<ClearChatResult> {
  const userId = await getUserId(await headers());
  if (!userId)
    return { error: "You're signed out. Sign in to clear the chat." };
  await clearLissieConversation(userId);
  refresh();
  return {};
}
