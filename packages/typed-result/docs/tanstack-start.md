# TanStack Start Examples

TanStack Start server functions are serializable boundaries. Returning
`Result.Success(...)` or `Result.Failure(...)` from the server function keeps
expected application failures in the value channel, so loaders, Query functions,
and components can handle them deliberately.

## Server Function

```ts
// src/server-functions/todos.ts
import { createServerFn } from "@tanstack/react-start"
import { Result } from "@codeva-dev/typed-result"

type Todo = {
  readonly id: string
  readonly title: string
  readonly completed: boolean
}

const TodoNotFound = Result.defineTaggedFailure<
  "TodoNotFound",
  { readonly todoId: string; readonly message: string }
>("TodoNotFound")

const TodoLoadFailed = Result.defineTaggedFailure<
  "TodoLoadFailed",
  { readonly message: string }
>("TodoLoadFailed")

const todos = new Map<string, Todo>([
  ["todo-1", { id: "todo-1", title: "Use typed-result", completed: false }],
])

export const getTodo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { todoId: string })
  .handler(async ({ data }) => {
    const todo = todos.get(data.todoId)

    if (!todo) {
      return Result.Failure(TodoNotFound, {
        todoId: data.todoId,
        message: "Todo does not exist",
      })
    }

    return Result.Success(todo)
  })
```

## Loader With `ensureQueryData`

```tsx
// src/routes/todos.$todoId.tsx
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Match, MatchFailureTags } from "@codeva-dev/typed-result/react"
import { getTodo } from "~/server-functions/todos"

const todoQuery = (todoId: string) =>
  queryOptions({
    queryKey: ["todo", todoId],
    queryFn: () => getTodo({ data: { todoId } }),
  })

export const Route = createFileRoute("/todos/$todoId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(todoQuery(params.todoId)),
  component: TodoRoute,
})

function TodoRoute() {
  const { todoId } = Route.useParams()
  const { data } = useSuspenseQuery(todoQuery(todoId))

  return (
    <Match
      result={data}
      onSuccess={(todo) => <h1>{todo.title}</h1>}
      onFailure={(failure) => (
        <MatchFailureTags
          failure={failure}
          tags={{
            TodoNotFound: (failure) => <p>{failure.message}</p>,
            TodoLoadFailed: (failure) => <p>{failure.message}</p>,
            default: (failure) => <p>{failure._tag}</p>,
          }}
        />
      )}
    />
  )
}
```

## Direct Loader Handling

Sometimes a route should directly call the server function in the loader and
decide which failures are recoverable for that route.

```ts
import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { Result } from "@codeva-dev/typed-result"
import { getTodo } from "~/server-functions/todos"

export const Route = createFileRoute("/direct/todos/$todoId")({
  loader: async ({ params }) => {
    const result = await getTodo({ data: { todoId: params.todoId } })

    return Result.match(result, {
      onSuccess: (todo) => todo,
      onFailure: (failure) => {
        switch (failure._tag) {
          case "TodoNotFound":
            throw notFound()

          case "TodoLoadFailed":
            return {
              id: "fallback",
              title: failure.message,
              completed: false,
            }
        }
      },
    })
  },
})
```

Use thrown route errors for non-recoverable route states. Return fallback data
when the route can still render a useful state.

## Schema-Validated Server Function

For real boundaries, prefer a schema adapter.

```ts
import { createServerFn } from "@tanstack/react-start"
import { Result, z } from "@codeva-dev/typed-result/zod"

const TodoInput = z.object({
  todoId: z.string(),
})

const Todo = Result.defineSuccess(
  z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  }),
)

const TodoNotFound = Result.defineFailure("TodoNotFound", {
  todoId: z.string(),
  message: z.string(),
})

const TodoResult = Result.defineSchema({
  success: Todo,
  failure: TodoNotFound,
})

export const getTodo = createServerFn({ method: "GET" })
  .inputValidator((input) => TodoInput.parse(input))
  .handler(async ({ data }) => {
    return TodoResult.Failure("TodoNotFound", {
      todoId: data.todoId,
      message: "Todo does not exist",
    })
  })
```

The caller can decode the payload before rendering:

```ts
const payload = await getTodo({ data: { todoId } })
const result = TodoResult.decode(payload)
```
