import "server-only";
import { createTool } from "@mastra/core/tools";
import type { ErrorBody } from "@todo-cat/contract";
import { z } from "zod";
import {
  addTodo,
  listTodos,
  TodoNotFoundError,
  updateTodo,
} from "../todo-service";
import { progressCard } from "./progress-card";
import { userIdKey } from "./request-context";
import {
  addTodoInput,
  addTodoOutput,
  listTodosInput,
  listTodosOutput,
  setTodoDoneInput,
  setTodoDoneOutput,
  showProgressInput,
  showProgressOutput,
} from "./todo-tool-schemas";

// Lissie's adapter on the todo service. Mastra parses each input with the tool's
// contract-based schema; the owner of every todo is the signed-in user, from the request
// context the CopilotKit route builds from the session, never from the model's arguments.
// Without that user Mastra refuses the call before `execute` runs.
const requestContextSchema = z.object({ [userIdKey]: z.string().min(1) });

function notFound(error: TodoNotFoundError): ErrorBody {
  return { error: { code: error.code, message: error.message } };
}

export const listTodosTool = createTool({
  id: "listTodos",
  description:
    "Lists the user's todos, open ones by default; use it before talking about what is on the list or to find a todo's id.",
  inputSchema: listTodosInput,
  outputSchema: listTodosOutput,
  requestContextSchema,
  execute: async (filter, { requestContext }) => ({
    todos: await listTodos(requestContext.get(userIdKey), filter),
  }),
});

export const addTodoTool = createTool({
  id: "addTodo",
  description: "Adds one todo to the user's list.",
  inputSchema: addTodoInput,
  outputSchema: addTodoOutput,
  requestContextSchema,
  execute: async (todo, { requestContext }) => ({
    todo: await addTodo(requestContext.get(userIdKey), todo),
  }),
});

export const setTodoDoneTool = createTool({
  id: "setTodoDone",
  description:
    "Marks one of the user's todos done, or reopens it; take the id from listTodos.",
  inputSchema: setTodoDoneInput,
  outputSchema: setTodoDoneOutput,
  requestContextSchema,
  execute: async ({ id, done }, { requestContext }) => {
    try {
      return {
        todo: await updateTodo(requestContext.get(userIdKey), id, { done }),
      };
    } catch (error) {
      if (error instanceof TodoNotFoundError) return notFound(error);
      throw error;
    }
  },
});

// The counts come from the list here, never from the model, and the tool returns the card
// itself as A2UI operations: the chat draws it straight from the result.
export const showProgressTool = createTool({
  id: "showProgress",
  description:
    "Shows the user a card in the chat with how many of their todos are done and how many are still open, counted from their list.",
  inputSchema: showProgressInput,
  outputSchema: showProgressOutput,
  requestContextSchema,
  execute: async (_input, { requestContext }) => {
    const todos = await listTodos(requestContext.get(userIdKey), {
      status: "all",
    });
    const done = todos.filter((todo) => todo.done).length;
    return progressCard({
      total: todos.length,
      done,
      open: todos.length - done,
    });
  },
});

/** Lissie's tools, keyed by the names the model and the chat see. */
export const todoTools = {
  listTodos: listTodosTool,
  addTodo: addTodoTool,
  setTodoDone: setTodoDoneTool,
  showProgress: showProgressTool,
};
