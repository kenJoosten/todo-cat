# Lissie, the agent

Lissie is one Mastra agent, served to the CopilotKit chat on `/` over AG-UI by a CopilotKit runtime inside the Next app. Her tools list, add and complete the signed-in user's todos, the same list the user edits next to the chat, and show a progress card in the chat.

## Files

- `lib/lissie/agent.ts`: the `lissie` agent, her system prompt (which ends with today's UTC date, for due dates), her tools, and her memory options.
- `lib/lissie/todo-tools.ts`: her tools, `listTodos`, `addTodo`, `setTodoDone` and `showProgress`, an adapter on the todo service.
- `lib/lissie/progress-card.ts`: the progress card's A2UI component tree and the operations `showProgress` returns (see Cards).
- `lib/lissie/a2ui-catalog.tsx` and `a2ui-catalog-id.ts`: her A2UI catalog, which the chat registers, and its id, which the cards name.
- `lib/lissie/todo-tool-schemas.ts`: the tools' input and output schemas, built from the contract and shared with the chat.
- `lib/lissie/request-context.ts`: `lissieRequestContext(userId, threadId)`, the Mastra request context of one run, and `userIdKey`.
- `lib/lissie/tool-call-line.ts`: the one line the chat shows for a tool call.
- `lib/lissie/model.ts`: the model, `openrouter/<OPENROUTER_MODEL>` (default `z-ai/glm-5.3-flash`) with `OPENROUTER_API_KEY`; the only module that reads either.
- `lib/lissie/mastra.ts`: the `Mastra` instance, with `LibSQLStore` on the client from `lib/db.ts`.
- `lib/lissie/thread.ts`: `lissieThreadId(userId)`, the id of a user's first thread.
- `lib/lissie/conversation.ts`: `currentLissieThreadId(userId)` and `clearLissieConversation(userId)` (see Memory).
- `lib/lissie/history.ts`: reads a thread from Mastra memory as AG-UI chat messages.
- `lib/lissie/runner.ts`: `LissieRunner`, the runtime's runner (see Memory).
- `app/api/copilotkit/[[...slug]]/route.ts`: the CopilotKit runtime, multi-route, under `/api/copilotkit`.
- `app/api/copilotkit/[[...slug]]/guard.ts`: the authorization hooks for every runtime route.
- `app/lissie-chat.tsx` and `app/lissie-chat.css`: the chat (`CopilotKit` and `CopilotChat` from `@copilotkit/react-core/v2`), themed with Lissie's palette.
- `app/lissie-tool-calls.tsx`: inside the chat's provider, renders every tool call as its line and refreshes the page after a change.
- `app/lissie-clear-chat.tsx` and `app/lissie-actions.ts`: the Clear chat button beside the heading, and its Server Action.

## Versions

- `@mastra/*`, `@ag-ui/*`, `@copilotkit/*`, `@a2ui/*` and `rxjs` are pinned exactly, the A2UI packages to the versions `@copilotkit/*` depends on; the bridge (`@ag-ui/mastra`) and the runtime are tested against specific Mastra and AG-UI versions, so upgrade them together.
- Import CopilotKit from the `/v2` subpaths only; the package roots are the deprecated v1 API and mix silently.

## Authorization

- Memory scoping and the runtime are authorization, like the todo service: the user id always comes from `getUserId` on the request, never from the browser.
- `guard.onRequest` answers 401 to any request without a session cookie or bearer token, on every path, before the runtime routes it.
- `guard.onBeforeHandler` is an allowlist: `info`; `agent/run` and `agent/connect` for agent `lissie` with the caller's current thread id in the body; `agent/stop` and `threads/{messages,events,state}` for the caller's current thread in the path.
- The `inspector/metadata` and `inspector/learning` routes are allowed only when `NEXT_PUBLIC_COPILOTKIT_INSPECTOR` is on (both are Intelligence-only, so they carry no user data here); every other route (thread list, clear, update, archive, subscribe, suggest, transcribe, memories, debug events) is 404, and so is another user's thread, so a caller can't tell whether it exists.
- Without CopilotKit Intelligence the runtime scopes nothing to a user: its in-memory runner serves any thread id it is given, `GET /threads` lists every thread in the process, and `POST /threads/clear` wipes them all; the guard is the only thing in the way.
- The agents factory builds Lissie per request with `resourceId` set to the user id and the request context from `lissieRequestContext` for the user's current thread: Mastra's `MASTRA_RESOURCE_ID_KEY` and `MASTRA_THREAD_ID_KEY`, which Mastra prefers over anything in the run input, and `userIdKey` for the tools.

## Tools

- The tools take the owner of every todo from `userIdKey` in the request context, never from their arguments; no input schema has a user id, and Mastra strips one the model adds anyway.
- Only the server sets `userIdKey`: the AG-UI bridge puts what the browser sends under its own `ag-ui` key, so neither the browser nor the model can reach it.
- Each tool declares a `requestContextSchema` that requires `userIdKey`, so Mastra refuses the call before `execute` runs when it is missing, and returns the refusal to the model as the result.
- Mastra parses each input with the tool's contract-based schema and returns a rejection to the model the same way; `setTodoDone` returns the contract's `todo-not-found` error body for an id that is not the user's.
- The persona lives in the prompt: Lissie comments in character on every todo she adds or marks done, and has opinions about todos that feed her.
- No rename, reschedule or delete tools yet; the prompt tells her to say so.

## The chat and the list

- One wildcard `useRenderTool` renderer draws every tool call as one line from `toolCallLine`, which parses the arguments and the result with the tools' own schemas; JSON never reaches the user.
- The bridge streams a server tool call's start, arguments, end and result in one flush after the tool has run (`streamServerToolCalls` is off), so a line appears once the call is done.
- The list on `/` gets its todos from the page, a server component; `LissieToolCalls` subscribes to the shared `lissie` agent and calls `router.refresh()` when an `addTodo` or `setTodoDone` result arrives, which renders the page and the list again without touching the chat's state.
- When you add a route or upgrade CopilotKit, check `fetch-router` in `@copilotkit/runtime` for new routes and add them to the guard and to `everyRoute` in the test.

## Cards

- `showProgress` counts the user's todos with the todo service and returns the card itself as A2UI operations under `a2ui_operations` (`createSurface`, `updateComponents`, `updateDataModel`), so the model never produces the numbers and no second model call draws the card.
- The runtime's `a2ui` option adds the A2UI middleware, which turns those operations in a tool result into an `a2ui-surface` activity message; the chat renders it with the catalog on `<CopilotKit a2ui>`.
- The component tree is a constant in `progress-card.ts`; the numbers are only in the data model, bound with `{ path }` or `${/path}` placeholders in a `formatString` Text, so the tree is the same for every list.
- No generated surfaces: `injectA2UITool: false` on the runtime and on the `MastraAgent`; the bridge otherwise adds a UI-generating `generate_a2ui` tool whenever a run's `forwardedProps` ask for it, and the browser writes those.
- The chat sets `includeSchema: false`, so runs don't carry the catalog's schemas and generation guidelines, which only a generating tool reads.
- The catalog is the basic catalog plus `ProgressBar` and a `Card` in the app's palette; a component listed later in the `Catalog` replaces the basic one of the same name.
- History replay adds the card back after the tool result, as an activity message with the middleware's id (`a2ui-surface-<tool call id>`); the bridge drops activity messages when the browser resends them, so they are never stored.

## Memory

- Mastra memory is message history only (`lastMessages: 20` in context), in the app's SQLite file; Mastra creates its `mastra_*` tables itself on first use, outside our Drizzle migrations.
- One thread per user at a time, with the user id as Mastra's resource: `lissie-<user id>` at first, and `currentLissieThreadId` reads which one it is; the page passes it to `CopilotChat` as `threadId`.
- Clear chat makes a new thread (`lissie-<user id>-<uuid>`) current and deletes the old one from Mastra memory, rather than emptying the old one, because CopilotKit's in-memory runner keeps a thread's past runs and replays them to a connect during a run, with no public way to drop one thread.
- After clearing, the button drops the chat's messages with `agent.setMessages([])`, since a new explicit `threadId` on `CopilotChat` connects to the new thread but keeps the old messages on screen; it is off while Lissie replies, so no run outlives its thread.
- The bridge sends Mastra only the messages it has not stored yet, so the browser resending the whole conversation does not duplicate history.
- CopilotKit's `InMemoryAgentRunner` forgets every thread on restart, so `LissieRunner.connect` replays the conversation from Mastra memory as one `MESSAGES_SNAPSHOT`; only a connect during a live run goes to the in-memory runner.
- Mastra stores an assistant turn as one message whose parts mix text and tool invocations; the replay splits it into AG-UI messages in order (text, an assistant message with `toolCalls`, one tool message per result, more text).
- The split messages take the bridge's continuation ids (`<stored id>-agui-text`, `-agui-text-2`, …), which it recognises as stored; any other id would be forwarded to Mastra again when the browser resends the history, and stored twice.

## Gotchas

- A2UI's binder decides which props are bindable by reading zod 3 internals, and A2UI ships its own copy of zod 3; schemas from the app's zod (or `zod/v3`) send `tsc` into infinite instantiation, so catalog props are built from A2UI's own schemas (`SliderApi.schema.pick(...)`, `DynamicNumberSchema`).
- A bindable prop must be a union with `{ path }` (`DynamicNumberSchema`, `DynamicStringSchema`); a plain `number` prop gets the binding object, not the value.
- Biome reports `${/path}` in a string literal as a template mistake; `progress-card.ts` builds the placeholders with a helper.
- The runtime forwards `authorization` and `x-*` request headers to the agent, and the bridge passes them to the model call, which would send a user's bearer token to OpenRouter; `forwardHeaders` in the route denies them all.
- An explicit `threadId` on `CopilotChat` turns off its welcome screen; that is the price of history replay.
- `<CopilotKit agentId>` does not reach `CopilotChat`, which then asks for an agent named `default`; name the agent on `CopilotChat`.
- The CopilotKit Inspector (a dev overlay) and the guard's `inspector/*` routes are both gated by `NEXT_PUBLIC_COPILOTKIT_INSPECTOR` via `lib/lissie/inspector.ts`, off unless it is `"true"`; the debug-events route stays 404 regardless.
- `COPILOTKIT_TELEMETRY_DISABLED=true` in `.env` stops the runtime sending usage telemetry; `.env.example` sets it, so CI never calls out.
- `recall()` throws for a thread that does not exist yet, so `lissieHistory` checks `getThreadById` first.

## Tests

- `app/api/copilotkit/[[...slug]]/copilotkit-api.test.ts` calls the route handlers on a temp database with two users and a scripted model (`MockLanguageModelV3` from `ai/test`, replacing `lib/lissie/model.ts` with `vi.mock`).
- It covers 401 on every route, 404 on every unused route, another user's run, connect, stop (during a live run), reads and clear, the memory written per user, the bearer token never reaching the model, history after a simulated restart, and clearing a chat (a new thread, the old one forgotten and 404).
- With `model.toolCall` set, the scripted model calls that tool first; the tests check that a run's tools act for the session's user whatever the model sends, and that tool calls replay after a restart and are not stored twice when the browser resends them.
- A run streams, so the scripted model is only called while the test reads the response body; reset `model.toolCall` after that, not after the response arrives.
- `lib/lissie/todo-tools.test.ts` runs the tool executors on a temp database with two users: each tool reaches only the signed-in user's todos, and refuses to run without a user id in the request context; `showProgress`'s operations pass A2UI's message schema and the middleware's validator (`@ag-ui/a2ui-toolkit`) against the chat's catalog, and its counts match the rows.
- `lib/lissie/a2ui-catalog.test.tsx` renders the progress card's operations through the catalog, so a binding that doesn't resolve fails there.
- The route test also covers the card arriving as an activity, no UI-generating tool reaching the model even when `forwardedProps` ask for one, and the card replayed after a restart.
- `lib/lissie/tool-call-line.test.ts` covers the line for every tool, state and failure.
- `e2e/lissie.spec.ts` (QA) loads the chat without errors or rejected runtime calls, shows a conversation, a tool call and a progress card written straight into Mastra memory, clears a conversation for good, and shows todos changed through the REST API on the list.
- `e2e/lissie.model.spec.ts` sends a real message and reloads; `e2e/lissie-tools.model.spec.ts` asks Lissie to add "buy milk" and finds it on the list, live and after a reload. Both need a real `OPENROUTER_API_KEY` and run only with `npm run test:e2e:model` (`npm run test:e2e:model:tools` for the second alone), never in QA or CI.
