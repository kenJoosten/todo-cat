"use client";

import type { Todo, TodoStatus } from "@todo-cat/contract";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { CodeField, Field, SelectField } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import {
  type Auth,
  type ContractCheck,
  checkResponse,
  type EndpointId,
  endpointById,
  endpoints,
  needsTodoId,
  type RequestInput,
  requestInit,
  requestPath,
  toCurl,
  todosIn,
} from "./requests";

const statusTexts: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  500: "Internal Server Error",
};

const methodColors = {
  GET: "bg-line text-ink",
  POST: "bg-amber text-ink",
  PATCH: "bg-ink text-ground",
  DELETE: "bg-danger text-white",
};

type Sent = {
  method: string;
  path: string;
  status: number;
  milliseconds: number;
  headers: [string, string][];
  text: string;
  check: ContractCheck;
  todos: Todo[];
};

// What Better Auth's sign-in and sign-up endpoints answer, as far as the tester cares.
const signedInSchema = z.object({ user: z.object({ email: z.string() }) });
const authErrorSchema = z.object({ message: z.string() });

function prettyBody(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function SignInPanel({
  onToken,
}: {
  onToken: (token: string, email: string) => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  // Fetches with credentials omitted, so the browser never stores a session cookie and
  // the token is the only proof of identity, as it will be for the CLI.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    const signUp = intent === "sign-up";
    const body = {
      email: form.get("email"),
      password: form.get("password"),
      ...(signUp && { name: form.get("name") }),
    };
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(
        signUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          credentials: "omit",
        },
      );
      const json: unknown = await response.json().catch(() => null);
      const token = response.headers.get("set-auth-token");
      const signedIn = signedInSchema.safeParse(json);
      if (response.ok && token && signedIn.success) {
        onToken(token, signedIn.data.user.email);
        return;
      }
      const failure = authErrorSchema.safeParse(json);
      setError(
        failure.success
          ? `${failure.data.message} (${response.status})`
          : `Signing in answered ${response.status} without a token`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue="demo@todo-cat.dev"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          defaultValue="cat-person-2026"
          required
        />
      </div>
      <Field
        label="Name"
        name="name"
        hint="Only used when you create an account."
      />
      <FormError message={error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="sign-in" disabled={pending}>
          Sign in
        </Button>
        <Button
          type="submit"
          value="sign-up"
          variant="secondary"
          disabled={pending}
        >
          Create account
        </Button>
      </div>
      <p className="text-sm text-muted">
        The demo account exists after <code>npm run db:seed</code>.
      </p>
    </form>
  );
}

function ResponsePanel({
  sent,
  onUseId,
}: {
  sent?: Sent;
  onUseId: (id: string) => void;
}) {
  if (!sent) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg bg-ink p-8 text-center text-ground/70">
        <p className="max-w-60 text-pretty">
          Send a request and the answer lands here.
        </p>
      </div>
    );
  }
  const success = sent.status < 400;
  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-5 rounded-lg bg-ink p-6 text-ground sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p
          className={`font-display text-7xl leading-none font-bold tracking-tight ${success ? "text-amber" : "text-danger-light"}`}
        >
          <span className="sr-only">Status </span>
          {sent.status}
        </p>
        <p className="pb-1 text-right text-ground/70">
          {statusTexts[sent.status] ?? ""} in {sent.milliseconds} ms
        </p>
      </div>
      <p className="font-mono text-sm break-all text-ground/70">
        {sent.method} {sent.path}
      </p>
      <p
        className={`rounded-md px-3 py-2 text-sm font-medium ${sent.check.ok ? "bg-ground/10 text-ground" : "bg-danger-light/20 text-ground"}`}
      >
        {sent.check.ok ? "Matches the contract. " : "Breaks the contract. "}
        <span className="font-normal">{sent.check.message}.</span>
      </p>

      {sent.todos.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-ground/70">
            Todos in this answer
          </h3>
          <ul className="flex flex-col divide-y divide-ground/10 rounded-md bg-ground/5">
            {sent.todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span
                  className={`min-w-0 truncate ${todo.done ? "text-ground/50 line-through" : ""}`}
                >
                  {todo.title}
                  {todo.dueDate && (
                    <span className="ml-2 text-sm text-ground/60">
                      due {todo.dueDate}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onUseId(todo.id)}
                  aria-label={`Use the id of ${todo.title}`}
                  className="shrink-0 rounded px-2 py-1 text-sm font-semibold text-amber hover:bg-ground/10 focus-visible:outline-2 focus-visible:outline-amber"
                >
                  Use id
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-ground/70">Body</h3>
        <pre className="max-h-[28rem] overflow-auto rounded-md bg-black/30 p-4 font-mono text-sm leading-relaxed">
          {sent.text ? prettyBody(sent.text) : "(empty)"}
        </pre>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-medium text-ground/70 hover:text-ground">
          Response headers
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          {sent.headers.map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="text-ground/60">{name}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

export function ApiTester() {
  const [token, setToken] = useState("");
  const [signedInAs, setSignedInAs] = useState<string>();
  const [authMode, setAuthMode] = useState<Auth["mode"]>("bearer");
  const [endpointId, setEndpointId] = useState<EndpointId>("list");
  const [input, setInput] = useState<RequestInput>({
    todoId: "",
    status: "all",
    q: "",
    body: "",
  });
  const [sent, setSent] = useState<Sent>();
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const endpoint = endpointById(endpointId);
  const auth: Auth =
    authMode === "bearer" ? { mode: "bearer", token } : { mode: authMode };
  const missingId = needsTodoId(endpoint) && input.todoId.trim() === "";
  const missingToken = authMode === "bearer" && token === "";

  function update(changes: Partial<RequestInput>) {
    setInput((current) => ({ ...current, ...changes }));
    setCopied(false);
  }

  function chooseEndpoint(id: EndpointId) {
    setEndpointId(id);
    update({ body: endpointById(id).sampleBody ?? "" });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = requestPath(endpoint, input);
    setSending(true);
    try {
      const started = performance.now();
      const response = await fetch(path, requestInit(endpoint, input, auth));
      const text = await response.text();
      setSent({
        method: endpoint.method,
        path,
        status: response.status,
        milliseconds: Math.round(performance.now() - started),
        headers: [...response.headers.entries()],
        text,
        check: checkResponse(endpoint, response.status, text),
        todos: todosIn(text),
      });
    } finally {
      setSending(false);
    }
  }

  async function copyCurl() {
    await navigator.clipboard.writeText(
      toCurl(window.location.origin, endpoint, input, auth),
    );
    setCopied(true);
  }

  return (
    <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col gap-12">
        <section aria-labelledby="who">
          <h2 id="who" className="mb-4 font-display text-2xl font-bold">
            Who's asking
          </h2>
          {signedInAs ? (
            <div className="flex flex-col gap-4">
              <p>
                Signed in as <strong>{signedInAs}</strong>. Requests carry the
                token below.
              </p>
              <div>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setSignedInAs(undefined);
                    setToken("");
                  }}
                >
                  Use another account
                </Button>
              </div>
            </div>
          ) : (
            <SignInPanel
              onToken={(newToken, email) => {
                setToken(newToken);
                setSignedInAs(email);
                setAuthMode("bearer");
              }}
            />
          )}
          <div className="mt-6">
            <Field
              label="Bearer token"
              name="token"
              value={token}
              onChange={(event) => setToken(event.target.value.trim())}
              placeholder="Sign in above, or paste a token"
              mono
            />
          </div>
        </section>

        <section aria-labelledby="request">
          <h2 id="request" className="mb-4 font-display text-2xl font-bold">
            Request
          </h2>
          <form onSubmit={send} className="flex flex-col gap-6">
            <ChoiceGroup
              legend="Endpoint"
              name="endpoint"
              value={endpointId}
              onChange={chooseEndpoint}
              choices={endpoints.map((candidate) => ({
                value: candidate.id,
                label: (
                  <span className="flex items-baseline gap-2 font-mono text-sm">
                    <span
                      className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold ${methodColors[candidate.method]}`}
                    >
                      {candidate.method}
                    </span>
                    <span className="break-all">{candidate.path}</span>
                  </span>
                ),
                description: candidate.summary,
              }))}
            />

            {needsTodoId(endpoint) && (
              <Field
                label="Todo id"
                name="todoId"
                value={input.todoId}
                onChange={(event) => update({ todoId: event.target.value })}
                hint="Send a list request first, then pick Use id next to a todo."
                mono
              />
            )}

            {endpoint.id === "list" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Status"
                  name="status"
                  value={input.status}
                  onChange={(event) =>
                    update({ status: event.target.value as TodoStatus })
                  }
                >
                  <option value="open">open</option>
                  <option value="done">done</option>
                  <option value="all">all</option>
                </SelectField>
                <Field
                  label="Title contains"
                  name="q"
                  value={input.q}
                  onChange={(event) => update({ q: event.target.value })}
                  placeholder="Leave empty for every title"
                />
              </div>
            )}

            {endpoint.sampleBody !== undefined && (
              <CodeField
                label="JSON body"
                name="body"
                rows={5}
                value={input.body}
                onChange={(event) => update({ body: event.target.value })}
                hint="Sent exactly as typed, so you can try invalid input too."
              />
            )}

            <ChoiceGroup
              legend="Authentication"
              name="auth"
              value={authMode}
              onChange={setAuthMode}
              choices={[
                {
                  value: "bearer",
                  label: "Bearer token",
                  description: "How the CLI calls",
                },
                {
                  value: "cookie",
                  label: "Browser session cookie",
                  description: "If you're signed in to the app",
                },
                {
                  value: "none",
                  label: "None",
                  description: "Expect a 401",
                },
              ]}
            />

            {missingToken && (
              <p className="text-sm text-muted">
                Sign in or paste a token to send a bearer request.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={sending || missingId || missingToken}
              >
                {sending ? "Sending…" : "Send request"}
              </Button>
              <Button
                variant="secondary"
                onClick={copyCurl}
                disabled={missingId || authMode === "cookie"}
                title={
                  authMode === "cookie"
                    ? "curl can't borrow your browser's cookie; switch to a bearer token"
                    : undefined
                }
              >
                {copied ? "Copied" : "Copy as curl"}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <section aria-labelledby="response" className="lg:sticky lg:top-8">
        <h2 id="response" className="mb-4 font-display text-2xl font-bold">
          Response
        </h2>
        <ResponsePanel
          sent={sent}
          onUseId={(id) => {
            update({ todoId: id });
            if (!needsTodoId(endpoint)) chooseEndpoint("get");
          }}
        />
      </section>
    </div>
  );
}
