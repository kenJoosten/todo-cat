/**
 * Each user has exactly one conversation with Lissie, so its id follows from the user id.
 * The CopilotKit route only lets a user address this thread, and Mastra memory is keyed
 * by the same id with the user id as its resource.
 */
export function lissieThreadId(userId: string) {
  return `lissie-${userId}`;
}
