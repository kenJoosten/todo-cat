# Lissie, the agent

Lissie is one Mastra agent, served to the CopilotKit chat on `/` over AG-UI by a CopilotKit runtime inside the Next app. She has no tools yet, so she can talk about the list but not see or change it.

## Files

- `lib/lissie/agent.ts`: the `lissie` agent, her system prompt, and her memory options.
- `lib/lissie/model.ts`: the model, `openrouter/<OPENROUTER_MODEL>` (default `z-ai/glm-5.3-flash`) with `OPENROUTER_API_KEY`; the only module that reads either.
- `lib/lissie/mastra.ts`: the `Mastra` instance, with `LibSQLStore` on the client from `lib/db.ts`.
- `lib/lissie/thread.ts`: `lissieThreadId(userId)`, the one thread a user has.
- `lib/lissie/history.ts`: reads a thread from Mastra memory as AG-UI chat messages.
- `lib/lissie/runner.ts`: `LissieRunner`, the runtime's runner (see Memory).
- `app/api/copilotkit/[[...slug]]/route.ts`: the CopilotKit runtime, multi-route, under `/api/copilotkit`.
- `app/api/copilotkit/[[...slug]]/guard.ts`: the authorization hooks for every runtime route.
- `app/lissie-chat.tsx` and `app/lissie-chat.css`: the chat (`CopilotKit` and `CopilotChat` from `@copilotkit/react-core/v2`), themed with Lissie's palette.

## Versions

- `@mastra/*`, `@ag-ui/*`, `@copilotkit/*` and `rxjs` are pinned exactly; the bridge (`@ag-ui/mastra`) and the runtime are tested against specific Mastra and AG-UI versions, so upgrade them together.
- Import CopilotKit from the `/v2` subpaths only; the package roots are the deprecated v1 API and mix silently.

## Authorization

- Memory scoping and the runtime are authorization, like the todo service: the user id always comes from `getUserId` on the request, never from the browser.
- `guard.onRequest` answers 401 to any request without a session cookie or bearer token, on every path, before the runtime routes it.
- `guard.onBeforeHandler` is an allowlist: `info`; `agent/run` and `agent/connect` for agent `lissie` with the caller's own thread id in the body; `agent/stop` and `threads/{messages,events,state}` for the caller's own thread in the path.
- Every other route (thread list, clear, update, archive, subscribe, suggest, transcribe, memories, inspector, debug events) is 404, and so is another user's thread, so a caller can't tell whether it exists.
- Without CopilotKit Intelligence the runtime scopes nothing to a user: its in-memory runner serves any thread id it is given, `GET /threads` lists every thread in the process, and `POST /threads/clear` wipes them all; the guard is the only thing in the way.
- The agents factory builds Lissie per request with `resourceId` set to the user id, and sets Mastra's `MASTRA_RESOURCE_ID_KEY` and `MASTRA_THREAD_ID_KEY` in the request context, which Mastra prefers over anything in the run input.
- When you add a route or upgrade CopilotKit, check `fetch-router` in `@copilotkit/runtime` for new routes and add them to the guard and to `everyRoute` in the test.

## Memory

- Mastra memory is message history only (`lastMessages: 20` in context), in the app's SQLite file; Mastra creates its `mastra_*` tables itself on first use, outside our Drizzle migrations.
- One thread per user: `lissie-<user id>`, with the user id as Mastra's resource; the page passes it to `CopilotChat` as `threadId`.
- The bridge sends Mastra only the messages it has not stored yet, so the browser resending the whole conversation does not duplicate history.
- CopilotKit's `InMemoryAgentRunner` forgets every thread on restart, so `LissieRunner.connect` replays the conversation from Mastra memory as one `MESSAGES_SNAPSHOT`; only a connect during a live run goes to the in-memory runner.

## Gotchas

- The runtime forwards `authorization` and `x-*` request headers to the agent, and the bridge passes them to the model call, which would send a user's bearer token to OpenRouter; `forwardHeaders` in the route denies them all.
- An explicit `threadId` on `CopilotChat` turns off its welcome screen; that is the price of history replay.
- `<CopilotKit agentId>` does not reach `CopilotChat`, which then asks for an agent named `default`; name the agent on `CopilotChat`.
- The CopilotKit Inspector, a dev overlay on localhost, is off (`enableInspector={false}`); the guard rejects its inspector and debug routes anyway.
- `COPILOTKIT_TELEMETRY_DISABLED=true` in `.env` stops the runtime sending usage telemetry; `.env.example` sets it, so CI never calls out.
- `recall()` throws for a thread that does not exist yet, so `lissieHistory` checks `getThreadById` first.

## Tests

- `app/api/copilotkit/[[...slug]]/copilotkit-api.test.ts` calls the route handlers on a temp database with two users and a scripted model (`MockLanguageModelV3` from `ai/test`, replacing `lib/lissie/model.ts` with `vi.mock`).
- It covers 401 on every route, 404 on every unused route, another user's run, connect, stop (during a live run), reads and clear, the memory written per user, the bearer token never reaching the model, and history after a simulated restart.
- `e2e/lissie.spec.ts` (QA) loads the chat without errors or rejected runtime calls, and shows a conversation written straight into Mastra memory.
- `e2e/lissie.model.spec.ts` sends a real message and reloads; it needs a real `OPENROUTER_API_KEY` and runs only with `npm run test:e2e:model`, never in QA or CI.
