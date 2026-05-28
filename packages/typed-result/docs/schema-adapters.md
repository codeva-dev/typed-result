# Schema Adapters

Schema adapters are exported from separate subpaths. Each adapter re-exports the
core API and adds schema-aware helpers.

```ts
import { Result, z } from "@codeva-dev/typed-result/zod"
import { Result, Schema } from "@codeva-dev/typed-result/effect"
```

The adapter namespace still includes the core API:

```ts
Result.Success(...)
Result.Failure(...)
Result.match(...)
Result.handle(...)
```

It also adds:

```ts
Result.defineSuccess(...)
Result.defineFailure(...)
Result.defineSchema(...)
```

## Zod

```ts
import { Result, z } from "@codeva-dev/typed-result/zod"

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

const TodoLoadFailed = Result.defineFailure("TodoLoadFailed", {
  message: z.string(),
})

const TodoResult = Result.defineSchema({
  success: Todo,
  failure: [TodoNotFound, TodoLoadFailed],
})
```

The individual descriptors can create typed values:

```ts
const success = Todo.Success({
  id: "todo-1",
  title: "Ship it",
  completed: false,
})

const failure = TodoNotFound.Failure({
  todoId: "todo-1",
  message: "Todo does not exist",
})
```

The combined schema can decode and encode boundary payloads:

```ts
const decoded = TodoResult.decode(payload)
const encoded = TodoResult.encode(decoded)
```

By default, invalid payloads throw `TypedResultDecodeError`.

```ts
import { TypedResultDecodeError } from "@codeva-dev/typed-result"

try {
  TodoResult.decode(payload)
} catch (error) {
  if (error instanceof TypedResultDecodeError) {
    console.error(error.cause)
  }
}
```

If invalid payloads are actionable in the current boundary, map them explicitly
to a domain failure:

```ts
const decoded = TodoResult.decode(payload, {
  onInvalid: "failure",
  failure: () =>
    TodoLoadFailed.Failure({
      message: "Todo API returned an invalid payload",
    }),
})
```

## Effect Schema

```ts
import { Result, Schema } from "@codeva-dev/typed-result/effect"

const Todo = Result.defineSuccess(
  Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    completed: Schema.Boolean,
  }),
)

const TodoNotFound = Result.defineFailure("TodoNotFound", {
  todoId: Schema.String,
  message: Schema.String,
})

const TodoLoadFailed = Result.defineFailure("TodoLoadFailed", {
  message: Schema.String,
})

const TodoResult = Result.defineSchema({
  success: Todo,
  failure: [TodoNotFound, TodoLoadFailed],
})
```

Usage is intentionally the same shape as the Zod adapter:

```ts
const result = TodoResult.decode(payload)

return Result.match(result, {
  onSuccess: (todo) => todo.title,
  onFailure: (failure) => failure.message,
})
```

## TanStack Start With Zod

TanStack Start server functions are a natural boundary for this package. The
server function returns a plain serialized `Result`, while loaders and
components can switch on the typed failure channel.

```ts
// src/server-functions/todos.ts
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

const TodoLoadFailed = Result.defineFailure("TodoLoadFailed", {
  message: z.string(),
})

export const TodoResult = Result.defineSchema({
  success: Todo,
  failure: [TodoNotFound, TodoLoadFailed],
})

const todos = new Map([
  ["todo-1", { id: "todo-1", title: "Use typed-result", completed: false }],
])

export const getTodo = createServerFn({ method: "GET" })
  .inputValidator((input) => TodoInput.parse(input))
  .handler(async ({ data }) => {
    const todo = todos.get(data.todoId)

    if (!todo) {
      return TodoNotFound.Failure({
        todoId: data.todoId,
        message: "Todo does not exist",
      })
    }

    return Todo.Success(todo)
  })
```

```tsx
// src/routes/todos.$todoId.tsx
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Match, MatchFailureTags } from "@codeva-dev/typed-result/react"
import { getTodo, TodoResult } from "~/server-functions/todos"

const todoQuery = (todoId: string) =>
  queryOptions({
    queryKey: ["todo", todoId],
    queryFn: async () => {
      const payload = await getTodo({ data: { todoId } })
      return TodoResult.decode(payload)
    },
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

## TanStack Start With Effect Schema

The Effect Schema adapter follows the same boundary pattern.

```ts
// src/server-functions/todos.ts
import { createServerFn } from "@tanstack/react-start"
import { Result, Schema } from "@codeva-dev/typed-result/effect"

const TodoInput = Schema.Struct({
  todoId: Schema.String,
})

const Todo = Result.defineSuccess(
  Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    completed: Schema.Boolean,
  }),
)

const TodoNotFound = Result.defineFailure("TodoNotFound", {
  todoId: Schema.String,
  message: Schema.String,
})

export const TodoResult = Result.defineSchema({
  success: Todo,
  failure: TodoNotFound,
})

const decodeInput = Schema.decodeUnknownSync(TodoInput)

export const getTodo = createServerFn({ method: "GET" })
  .inputValidator((input) => decodeInput(input))
  .handler(async ({ data }) => {
    return TodoNotFound.Failure({
      todoId: data.todoId,
      message: "Todo does not exist",
    })
  })
```

```ts
const payload = await getTodo({ data: { todoId } })
const result = TodoResult.decode(payload)
```

## Notes

- `success` and `failure` can be a single schema descriptor or an array.
- Failure schemas are always tagged.
- Descriptor-level `Failure(fields)` and `make(fields)` are field-typed.
- Result-schema-level `Failure(tag, fields)` validates at runtime by tag.
- Decode and encode errors are protocol errors. They throw unless you
  explicitly map invalid payloads into a domain failure with `onInvalid:
  "failure"`.
