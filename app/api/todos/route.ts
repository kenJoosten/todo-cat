import { newTodoSchema, todoListFilterSchema } from "@todo-cat/contract";
import { addTodo, listTodos } from "@/lib/todo-service";
import { parseBody, parseQuery, withUser } from "./rest";

export function GET(request: Request) {
  return withUser(request, async (userId) => {
    const filter = parseQuery(request, todoListFilterSchema);
    return Response.json(await listTodos(userId, filter));
  });
}

export function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = await parseBody(request, newTodoSchema);
    return Response.json(await addTodo(userId, input), { status: 201 });
  });
}
