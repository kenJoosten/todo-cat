import "server-only";
import type { MastraModelConfig } from "@mastra/core/llm";

export const defaultModel = "z-ai/glm-5.3-flash";

/**
 * Lissie's model, through OpenRouter: OPENROUTER_MODEL from the environment, or the default.
 * The key stays on the server; tests replace this module with a scripted model.
 */
export function lissieModel(): MastraModelConfig {
  return {
    id: `openrouter/${process.env.OPENROUTER_MODEL || defaultModel}`,
    apiKey: process.env.OPENROUTER_API_KEY,
  };
}
