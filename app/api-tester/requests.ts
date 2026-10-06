// The API tester's model of /api/todos: which requests exist, how to send them, and whether
// an answer matches the contract and tech-docs/rest-api.md. Pure, so it is unit-tested.
import {
  type ErrorCode,
  errorBodySchema,
  type TodoStatus,
  todoListSchema,
  todoSchema,
} from "@todo-cat/contract";
import type { z } from "zod";

export type EndpointId = "list" | "create" | "get" | "update" | "delete";

export type Endpoint = {
  id: EndpointId;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: "/api/todos" | "/api/todos/:id";
  summary: string;
  successStatus: 200 | 201 | 204;
  /** What a success body must match; null means no body at all. */
  successSchema: { name: string; schema: z.ZodType } | null;
  errorStatuses: (400 | 401 | 404)[];
  /** The JSON body the editor starts with; undefined for requests without a body. */
  sampleBody?: string;
};

const todo = { name: "todoSchema", schema: todoSchema };

export const endpoints: Endpoint[] = [
  {
    id: "list",
    method: "GET",
    path: "/api/todos",
    summary: "List todos",
    successStatus: 200,
    successSchema: { name: "todoListSchema", schema: todoListSchema },
    errorStatuses: [400, 401],
  },
  {
    id: "create",
    method: "POST",
    path: "/api/todos",
    summary: "Add a todo",
    successStatus: 201,
    successSchema: todo,
    errorStatuses: [400, 401],
    sampleBody: '{\n  "title": "Buy tuna",\n  "dueDate": "2026-10-31"\n}',
  },
  {
    id: "get",
    method: "GET",
    path: "/api/todos/:id",
    summary: "Get one todo",
    successStatus: 200,
    successSchema: todo,
    errorStatuses: [401, 404],
  },
  {
    id: "update",
    method: "PATCH",
    path: "/api/todos/:id",
    summary: "Change a todo",
    successStatus: 200,
    successSchema: todo,
    errorStatuses: [400, 401, 404],
    sampleBody: '{\n  "done": true\n}',
  },
  {
    id: "delete",
    method: "DELETE",
    path: "/api/todos/:id",
    summary: "Delete a todo",
    successStatus: 204,
    successSchema: null,
    errorStatuses: [401, 404],
  },
];

export function endpointById(id: EndpointId): Endpoint {
  const endpoint = endpoints.find((candidate) => candidate.id === id);
  if (!endpoint) throw new Error(`Unknown endpoint ${id}`);
  return endpoint;
}

export type RequestInput = {
  todoId: string;
  status: TodoStatus;
  q: string;
  body: string;
};

export type Auth =
  | { mode: "bearer"; token: string }
  | { mode: "cookie" }
  | { mode: "none" };

export const needsTodoId = (endpoint: Endpoint) =>
  endpoint.path === "/api/todos/:id";

/** The path and query string; an empty `q` is left out rather than sent as `q=`. */
export function requestPath(endpoint: Endpoint, input: RequestInput): string {
  if (needsTodoId(endpoint)) {
    return `/api/todos/${encodeURIComponent(input.todoId.trim())}`;
  }
  if (endpoint.method !== "GET") return endpoint.path;
  const query = new URLSearchParams({ status: input.status });
  if (input.q) query.set("q", input.q);
  return `${endpoint.path}?${query}`;
}

function requestHeaders(endpoint: Endpoint, auth: Auth) {
  const headers: Record<string, string> = {};
  if (auth.mode === "bearer") headers.authorization = `Bearer ${auth.token}`;
  if (endpoint.sampleBody !== undefined) {
    headers["content-type"] = "application/json";
  }
  return headers;
}

/**
 * The fetch options; the body goes out exactly as typed, so invalid JSON reaches the server.
 * Only cookie mode lets the browser send its session cookie.
 */
export function requestInit(
  endpoint: Endpoint,
  input: RequestInput,
  auth: Auth,
): RequestInit {
  return {
    method: endpoint.method,
    headers: requestHeaders(endpoint, auth),
    body: endpoint.sampleBody === undefined ? undefined : input.body,
    credentials: auth.mode === "cookie" ? "same-origin" : "omit",
  };
}

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** The same request as a curl command; a browser cookie can't be copied, so cookie mode has none. */
export function toCurl(
  origin: string,
  endpoint: Endpoint,
  input: RequestInput,
  auth: Auth,
): string {
  const parts = ["curl -i"];
  if (endpoint.method !== "GET") parts.push(`-X ${endpoint.method}`);
  parts.push(shellQuote(`${origin}${requestPath(endpoint, input)}`));
  for (const [name, value] of Object.entries(requestHeaders(endpoint, auth))) {
    parts.push(`-H ${shellQuote(`${name}: ${value}`)}`);
  }
  if (endpoint.sampleBody !== undefined) {
    parts.push(`-d ${shellQuote(input.body)}`);
  }
  return parts.join(" \\\n  ");
}

const errorCodeByStatus: Record<number, ErrorCode> = {
  400: "validation-failed",
  401: "unauthorized",
  404: "todo-not-found",
};

export type ContractCheck = { ok: boolean; message: string };

function issuesOf(error: z.ZodError) {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join(".")}: ${issue.message}`
        : issue.message,
    )
    .join("; ");
}

type Parsed<T> = { ok: true; message: string; data: T } | ContractCheck;

function checkJson<T extends z.ZodType>(
  text: string,
  name: string,
  schema: T,
): Parsed<z.output<T>> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message: `The body isn't JSON, so it can't match ${name}`,
    };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { ok: true, message: `The body matches ${name}`, data: result.data }
    : {
        ok: false,
        message: `The body doesn't match ${name}: ${issuesOf(result.error)}`,
      };
}

/** Whether a response is one the docs promise for this endpoint, with a body the contract allows. */
export function checkResponse(
  endpoint: Endpoint,
  status: number,
  text: string,
): ContractCheck {
  if (status === endpoint.successStatus) {
    if (endpoint.successSchema) {
      const { name, schema } = endpoint.successSchema;
      const { ok, message } = checkJson(text, name, schema);
      return { ok, message };
    }
    return text === ""
      ? { ok: true, message: "No body, as documented" }
      : {
          ok: false,
          message: `Expected no body, got ${text.length} characters`,
        };
  }

  const expectedCode = errorCodeByStatus[status];
  if (
    !endpoint.errorStatuses.some((code) => code === status) ||
    !expectedCode
  ) {
    const documented = [endpoint.successStatus, ...endpoint.errorStatuses];
    return {
      ok: false,
      message: `${status} isn't documented for this endpoint, which answers ${documented.join(", ")}`,
    };
  }
  const result = checkJson(text, "errorBodySchema", errorBodySchema);
  if (!("data" in result)) return result;
  const { code } = result.data.error;
  return code === expectedCode
    ? {
        ok: true,
        message: `The body matches errorBodySchema with code ${code}`,
      }
    : {
        ok: false,
        message: `A ${status} should carry code ${expectedCode}, not ${code}`,
      };
}

/** The todos inside a response body, so the tester can offer their ids; [] for anything else. */
export function todosIn(text: string): z.infer<typeof todoSchema>[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const list = todoListSchema.safeParse(json);
  if (list.success) return list.data;
  const one = todoSchema.safeParse(json);
  return one.success ? [one.data] : [];
}
