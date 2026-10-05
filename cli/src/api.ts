import {
  cliClientId,
  errorBodySchema,
  type NewTodo,
  type Todo,
  type TodoListFilter,
  type TodoUpdate,
  todoListSchema,
  todoSchema,
} from "@todo-cat/contract";
import { z } from "zod";
import { CliError } from "./errors";

// The CLI's only way to the server: the REST API for todos, Better Auth's endpoints for the
// session. Every response is parsed with a schema, so a server that breaks the shape fails loudly.

export const defaultServer = "http://localhost:3000";

/** The server from TODO_CAT_URL (default http://localhost:3000), without a trailing slash. */
export function serverUrl(): string {
  const raw = process.env.TODO_CAT_URL || defaultServer;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError("usage", `TODO_CAT_URL is not a URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CliError("usage", `TODO_CAT_URL must be http or https: ${raw}`);
  }
  return url.href.replace(/\/+$/, "");
}

/** Zod issues on one line, `path: message; …`, the way the server reports them. */
function issuesMessage(error: z.ZodError) {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join(".")}: ${issue.message}`
        : issue.message,
    )
    .join("; ");
}

/** Contract input checked before it is sent, so bad input fails with the code the server would use. */
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new CliError("validation-failed", issuesMessage(result.error));
  }
  return result.data;
}

function parseResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  path: string,
): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new CliError(
      "unexpected-response",
      `The response from ${path} does not match the expected shape: ${issuesMessage(result.error)}`,
    );
  }
  return result.data;
}

type Call = { method: string; token?: string; body?: unknown };

async function send(server: string, path: string, call: Call) {
  const headers = new Headers({ accept: "application/json" });
  if (call.token) headers.set("authorization", `Bearer ${call.token}`);
  if (call.body !== undefined) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${server}${path}`, {
      method: call.method,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
    });
  } catch {
    throw new CliError(
      "server-unreachable",
      `Cannot reach the todo-cat server at ${server}; start it, or point TODO_CAT_URL at it`,
    );
  }
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, ok: response.ok, json };
}

function serverError(status: number, path: string) {
  return status >= 500
    ? new CliError(
        "server-error",
        `The server failed with ${status} on ${path}`,
      )
    : new CliError(
        "unexpected-response",
        `The server answered ${status} on ${path} without a todo-cat error body`,
      );
}

/** The REST API at /api/todos, as the user whose session token this is. */
export class TodoApi {
  constructor(
    readonly server: string,
    private readonly token: string,
  ) {}

  private async call(method: string, path: string, body?: unknown) {
    const response = await send(this.server, path, {
      method,
      token: this.token,
      body,
    });
    if (response.ok) return response.json;
    const error = errorBodySchema.safeParse(response.json);
    if (!error.success) throw serverError(response.status, path);
    const { code, message } = error.data.error;
    if (code === "unauthorized") {
      throw new CliError(
        code,
        `The server no longer accepts your session at ${this.server}; run \`todo-cat login\``,
      );
    }
    throw new CliError(code, message);
  }

  async list(filter: TodoListFilter): Promise<Todo[]> {
    const query = new URLSearchParams({ status: filter.status });
    if (filter.q) query.set("q", filter.q);
    const path = `/api/todos?${query}`;
    return parseResponse(todoListSchema, await this.call("GET", path), path);
  }

  async get(id: string): Promise<Todo> {
    const path = todoPath(id);
    return parseResponse(todoSchema, await this.call("GET", path), path);
  }

  async add(input: NewTodo): Promise<Todo> {
    const path = "/api/todos";
    return parseResponse(
      todoSchema,
      await this.call("POST", path, input),
      path,
    );
  }

  async update(id: string, input: TodoUpdate): Promise<Todo> {
    const path = todoPath(id);
    return parseResponse(
      todoSchema,
      await this.call("PATCH", path, input),
      path,
    );
  }

  async delete(id: string): Promise<void> {
    await this.call("DELETE", todoPath(id));
  }
}

function todoPath(id: string) {
  return `/api/todos/${encodeURIComponent(id)}`;
}

// Better Auth's device authorization (RFC 8628) and session endpoints. These shapes are Better
// Auth's, not todo-cat's, so they are not in the contract; the CLI reads only the fields it uses.

const deviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number(),
  interval: z.number(),
});
export type DeviceCode = z.infer<typeof deviceCodeSchema>;

const deviceTokenSchema = z.object({ access_token: z.string() });
const oauthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

const sessionSchema = z
  .object({
    user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  })
  .nullable();
export type User = NonNullable<z.infer<typeof sessionSchema>>["user"];

export async function requestDeviceCode(server: string): Promise<DeviceCode> {
  const path = "/api/auth/device/code";
  const response = await send(server, path, {
    method: "POST",
    body: { client_id: cliClientId },
  });
  if (!response.ok) throw serverError(response.status, path);
  return parseResponse(deviceCodeSchema, response.json, path);
}

/** One poll for the session token: the token once approved, else the OAuth error code. */
export async function pollDeviceToken(
  server: string,
  deviceCode: string,
): Promise<{ token: string } | { error: string }> {
  const path = "/api/auth/device/token";
  const response = await send(server, path, {
    method: "POST",
    body: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: cliClientId,
    },
  });
  if (response.ok) {
    return {
      token: parseResponse(deviceTokenSchema, response.json, path).access_token,
    };
  }
  const error = oauthErrorSchema.safeParse(response.json);
  if (!error.success) throw serverError(response.status, path);
  return { error: error.data.error };
}

/** The user the session token belongs to, or null when the server no longer accepts it. */
export async function sessionUser(
  server: string,
  token: string,
): Promise<User | null> {
  const path = "/api/auth/get-session";
  const response = await send(server, path, { method: "GET", token });
  if (!response.ok) throw serverError(response.status, path);
  return (
    parseResponse(sessionSchema, response.json ?? null, path)?.user ?? null
  );
}

/** Ends the session on the server; a session that already ended counts as success. */
export async function signOut(server: string, token: string): Promise<void> {
  const path = "/api/auth/sign-out";
  const response = await send(server, path, {
    method: "POST",
    token,
    body: {},
  });
  if (response.ok || response.status === 401) return;
  throw serverError(response.status, path);
}
