# Hono HTTP API + React + TanStack Query

This example uses Hono as a plain HTTP boundary and TanStack Query in a React
client. The API returns a schema-encoded `Result`, and the React app decodes the
payload before rendering.

## Shared Schema

```ts
// src/shared/todo-result.ts
import { Result, z } from "@codeva-dev/typed-result/zod"

export const Todo = Result.defineSuccess(
  z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  }),
)

export const TodoList = Result.defineSuccess(z.array(Todo.schema))

export const TodoLoadFailed = Result.defineFailure("TodoLoadFailed", {
  message: z.string(),
})

export const TodoNotFound = Result.defineFailure("TodoNotFound", {
  todoId: z.string(),
  message: z.string(),
})

export const TodoListResult = Result.defineSchema({
  success: TodoList,
  failure: TodoLoadFailed,
})

export const TodoResult = Result.defineSchema({
  success: Todo,
  failure: [TodoNotFound, TodoLoadFailed],
})
```

## Hono API

```ts
// src/server/app.ts
import { Hono } from "hono"
import { TodoListResult, TodoResult } from "../shared/todo-result"

const todos = new Map([
  ["todo-1", { id: "todo-1", title: "Use typed-result", completed: false }],
])

export const app = new Hono()

app.get("/api/todos", (c) => {
  try {
    return c.json(TodoListResult.Success([...todos.values()]))
  } catch {
    return c.json(
      TodoListResult.Failure("TodoLoadFailed", {
        message: "Could not load todos",
      }),
      500,
    )
  }
})

app.get("/api/todos/:todoId", (c) => {
  const todoId = c.req.param("todoId")
  const todo = todos.get(todoId)

  if (!todo) {
    return c.json(
      TodoResult.Failure("TodoNotFound", {
        todoId,
        message: "Todo does not exist",
      }),
      404,
    )
  }

  return c.json(TodoResult.Success(todo))
})
```

## React Query Client

```tsx
// src/client/todos.ts
import { queryOptions } from "@tanstack/react-query"
import { TodoListResult, TodoResult, TodoLoadFailed } from "../shared/todo-result"

export const todosQuery = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    const response = await fetch("/api/todos")
    const payload = await response.json()

    return TodoListResult.decode(payload, {
      onInvalid: "failure",
      failure: () =>
        TodoLoadFailed.Failure({
          message: "Todo API returned an invalid payload",
        }),
    })
  },
})

export const todoQuery = (todoId: string) =>
  queryOptions({
    queryKey: ["todo", todoId],
    queryFn: async () => {
      const response = await fetch(`/api/todos/${todoId}`)
      const payload = await response.json()

      return TodoResult.decode(payload, {
        onInvalid: "failure",
        failure: () =>
          TodoLoadFailed.Failure({
            message: "Todo API returned an invalid payload",
          }),
      })
    },
  })
```

Transport errors still belong to TanStack Query's error path. Typed application
states belong to the `Result` value:

```tsx
// src/routes/todos.tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { Match, MatchFailureTags } from "@codeva-dev/typed-result/react"
import { todosQuery } from "../client/todos"

export function TodosRoute() {
  const { data } = useSuspenseQuery(todosQuery)

  return (
    <Match
      result={data}
      onSuccess={(todos) => (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>{todo.title}</li>
          ))}
        </ul>
      )}
      onFailure={(failure) => (
        <MatchFailureTags
          failure={failure}
          tags={{
            TodoLoadFailed: (failure) => <p>{failure.message}</p>,
            default: (failure) => <p>{failure._tag}</p>,
          }}
        />
      )}
    />
  )
}
```

## TanStack Router Loader

The same query can be preloaded in a TanStack Router loader:

```ts
import { createFileRoute } from "@tanstack/react-router"
import { todosQuery } from "../client/todos"

export const Route = createFileRoute("/todos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosQuery),
  component: TodosRoute,
})
```

The component still reads through `useSuspenseQuery(todosQuery)`, and the
loader-filled query cache provides the result.
