// What every /api/todos handler shares: resolve the user, parse input with the contract,
// and map errors to the contract's error body. Business rules stay in lib/todo-service.ts.
import type { ErrorBody, ErrorCode } from "@todo-cat/contract";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { TodoNotFoundError } from "@/lib/todo-service";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return Response.json({ error: { code, message } } satisfies ErrorBody, {
    status,
  });
}

class InvalidJsonError extends Error {}

/** The JSON body parsed with a contract schema; anything else ends in a 400. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new InvalidJsonError("The request body must be JSON");
  }
  return schema.parse(json);
}

/** The query string parsed with a contract schema; anything else ends in a 400. */
export function parseQuery<T extends z.ZodType>(
  request: Request,
  schema: T,
): z.output<T> {
  return schema.parse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
}

function issuesMessage(error: z.ZodError) {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join(".")}: ${issue.message}`
        : issue.message,
    )
    .join("; ");
}

/**
 * Runs a handler for the signed-in user (bearer token or session cookie).
 * Answers 401 before looking at the input, so callers without a user learn nothing.
 */
export async function withUser(
  request: Request,
  handler: (userId: string) => Promise<Response>,
): Promise<Response> {
  const userId = await getUserId(request.headers);
  if (!userId) {
    return errorResponse(
      401,
      "unauthorized",
      "Send Authorization: Bearer <token> or a session cookie",
    );
  }
  try {
    return await handler(userId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "validation-failed", issuesMessage(error));
    }
    if (error instanceof InvalidJsonError) {
      return errorResponse(400, "validation-failed", error.message);
    }
    if (error instanceof TodoNotFoundError) {
      return errorResponse(404, error.code, error.message);
    }
    throw error;
  }
}
