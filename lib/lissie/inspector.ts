/**
 * Whether the CopilotKit Inspector is on: the dev overlay in the chat and the
 * runtime's `inspector/*` routes the guard then allows. Off unless the env var is
 * exactly "true". The `NEXT_PUBLIC_` prefix is required so the client chat component
 * can read it; the guard reads the same value server-side, so both agree.
 */
export const inspectorEnabled =
  process.env.NEXT_PUBLIC_COPILOTKIT_INSPECTOR === "true";
