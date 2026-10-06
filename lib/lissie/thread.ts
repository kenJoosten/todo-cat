/**
 * The id of a user's first conversation with Lissie. Each user has one conversation at a
 * time, and clearing it starts a new thread (see `currentLissieThreadId`). The CopilotKit
 * route only lets a user address their current thread, and Mastra memory keeps it with the
 * user id as its resource.
 */
export function lissieThreadId(userId: string) {
  return `lissie-${userId}`;
}
