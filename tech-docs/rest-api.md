# REST API

`/api/todos` is the todo service over HTTP for non-browser clients, starting with the CLI; see [architecture.md](architecture.md) for the rules every adapter follows.

## Endpoints

Schemas are exports of `@todo-cat/contract`; every error body is an `errorBodySchema`.

- `GET /api/todos?status=open|done|all&q=text`: query `todoListFilterSchema` (status defaults to `open`); 200 `todoListSchema`; 400, 401.
- `POST /api/todos`: body `newTodoSchema`; 201 `todoSchema`; 400, 401.
- `GET /api/todos/:id`: 200 `todoSchema`; 401, 404.
- `PATCH /api/todos/:id`: body `todoUpdateSchema`; 200 `todoSchema`; 400, 401, 404.
- `DELETE /api/todos/:id`: 204 with no body; 401, 404.

Status codes map to error codes: 400 `validation-failed`, 401 `unauthorized`, 404 `todo-not-found`.

## Files

- `app/api/todos/route.ts` and `app/api/todos/[id]/route.ts`: one handler per endpoint, each parse, call, respond.
- `app/api/todos/rest.ts`: `withUser` resolves the user and maps errors; `parseBody` and `parseQuery` apply the contract schemas.
- `app/api/todos/todos-api.test.ts`: calls the route handlers on a temp database, with real bearer tokens from Better Auth's sign-up handler.

## Principles

- 401 comes before any input check, so a caller without a user learns nothing about ids or input rules.
- Another user's todo is 404, the same as an id that never existed.
- Unknown query parameters and body fields are dropped by the schemas, not rejected.
- Anything other than a contract or service error is rethrown, so Next answers 500 and logs it.

## Getting a bearer token with curl

Sign in (or sign up at `/api/auth/sign-up/email` with a `name` too) and read the `set-auth-token` response header:

```sh
TOKEN=$(curl -s -D - -o /dev/null http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"demo@todo-cat.dev","password":"cat-person-2026"}' \
  | awk -F': ' 'tolower($1)=="set-auth-token" {print $2}' | tr -d '\r')

curl -s 'http://localhost:3000/api/todos?status=all' -H "authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/todos -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"title":"Buy tuna","dueDate":"2026-10-31"}'
```

The demo account exists after `npm run db:seed`. The CLI will get its token from the device authorization flow instead ([auth.md](auth.md)).

## Gotchas

- `set-auth-token` holds `<session token>.<signature>`; send the whole value, since the bearer plugin accepts it signed or unsigned.
- A query value that fails its schema, such as an empty `q=`, is a 400 like any other invalid input.
