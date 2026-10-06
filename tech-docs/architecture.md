# Architecture

todo-cat has one piece of business logic, the todo service, and several thin adapters
around it. Hexagonal (ports and adapters), without the ceremony.

```
 browser pages ──┐
 REST /api/todos ┤                       ┌──────────────┐
 agent tools   ──┼── getUserId(headers) ─▶ todo service ├──▶ lib/db.ts ──▶ SQLite
 MCP over HTTP* ─┘                       └──────┬───────┘
                                                │ types and schemas
 CLI, stdio MCP* ──▶ REST /api/todos       contract/ (@todo-cat/contract, zod)

 * not built yet
```

## The todo service

- One module, `lib/todo-service.ts`, holds every todo query and rule. Nothing else
  touches the `todos` table.
- Use cases, not tables: list (filter by status open/done/all and by text), get, add,
  update (title, due date, done), delete.
- **Every function takes the user id first, and every query filters by it.** There is
  no function that reads or writes todos without an owner.
- Another user's todo is "not found", never "forbidden": the API must not reveal that
  an id exists.
- The service returns contract types (plain objects, dates as ISO strings), never
  Drizzle rows.
- Errors carry stable codes from the contract's `errorCodeSchema`, and adapters map
  them instead of inventing their own: the service throws `TodoNotFoundError`
  (`todo-not-found`), and adapters report `validation-failed` when a contract schema
  rejects the input.
- `replaceTodos` exists only for the dev seed, which needs past timestamps; no adapter
  exposes it.

## Data

- A due date is a date without time and stays an ISO `yyyy-mm-dd` string everywhere.
  A JavaScript `Date` is midnight UTC and shows the previous day west of Greenwich.

## The contract

- The `contract/` workspace (`@todo-cat/contract`) holds what server and clients share:
  the zod schemas, the error body, and the device login's client id and code format.
- Server and clients import the same schemas. The CLI parses every response with
  them, so a server change that breaks the shape fails loudly in the client.
- Validation lives in the schemas, at the adapter boundary. The service trusts its
  typed input but always enforces ownership.

## Adapters

- An adapter does four things: parse the input with a contract schema, resolve the
  user with `getUserId` (from `lib/auth.ts`), call the service, map errors to its
  protocol. No business rules in adapters.
- **Browser** (`app/todo-actions.ts`): Server Actions for the list on `/`; they check the session before the input, return the contract's error body instead of throwing, and call `refresh()` from `next/cache` after a change so the page renders the service's state.
- **REST** (`/api/todos`, see [rest-api.md](rest-api.md)): for non-browser clients.
- **CLI** (`cli/`, see [cli.md](cli.md)): a client of the REST API, never of the database.
- **Chat** (`/api/copilotkit`, see [agent.md](agent.md)): the CopilotKit runtime serving Lissie; it resolves the user with `getUserId` and puts that user in Mastra's request context for her memory and her tools.
- **Agent tools** (`lib/lissie/todo-tools.ts`): `listTodos`, `addTodo`, `setTodoDone` and `showProgress` call the service directly. Their input schemas are built from the contract and take no user id; the owner comes from the request context the chat route builds from the session, and a tool without one refuses to run.
- **MCP** (not built yet): over stdio inside the CLI (a REST client again), over HTTP
  inside the app (calls the service, like the REST routes).

## Deliberately not done

- No generic repository, unit of work, or DI container. The service module is the seam;
  tests run it against a temp SQLite file.
- No pagination, sharing between users, soft delete, or optimistic concurrency.

## Tests

- The service is tested against a temp database with **two users for every use case**:
  one user never sees, changes, or deletes the other's todos (`lib/todo-service.test.ts`).
- Adapter tests cover only the mapping: 401 without a user, error codes, status codes.
