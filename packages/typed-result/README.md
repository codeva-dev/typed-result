# @codeva-dev/typed-result

A serializable typed Result model for boundary responses.

`@codeva-dev/typed-result` gives TypeScript applications a small plain-data
response shape for values that cross JSON, HTTP, server functions, RPC-like
calls, SSR loaders, caches, storage, workers, queues, CLI output, AI-to-AI
messages, or any other serializable channel.

It is designed for actionable application failures: states the caller can
handle deliberately instead of losing them as `unknown`, thrown framework
errors, or ad-hoc response objects.

Result values are plain serializable data. No methods are attached to returned
instances.

```json
{
  "_kind": "Failure",
  "_tag": "TodoNotFound",
  "failure": {
    "_tag": "TodoNotFound",
    "todoId": "todo-1",
    "message": "Todo does not exist"
  }
}
```

## Install

```sh
npm install @codeva-dev/typed-result
```

Core import:

```ts
import { Result } from "@codeva-dev/typed-result"
```

React helpers:

```ts
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
```

Zod v4 adapter:

```ts
import { Result, z } from "@codeva-dev/typed-result/zod"
```

Effect Schema adapter:

```ts
import { Result, Schema } from "@codeva-dev/typed-result/effect"
```

## Quick Example

```ts
import { Result } from "@codeva-dev/typed-result"

const TodoNotFound = Result.defineTaggedFailure<
  "TodoNotFound",
  { readonly todoId: string; readonly message: string }
>("TodoNotFound")

const result =
  Math.random() > 0.5
    ? Result.Success({ id: "todo-1", title: "Ship typed boundaries" })
    : Result.Failure(TodoNotFound, {
        todoId: "todo-1",
        message: "Todo does not exist",
      })

const viewModel = Result.match(result, {
  onSuccess: (todo) => ({ status: "ready" as const, todo }),
  onFailure: (failure) => {
    switch (failure._tag) {
      case "TodoNotFound":
        return { status: "missing" as const, message: failure.message }
    }
  },
})
```

## Data Shape

```ts
type Result<S, F extends TaggedFailure> = Success<S> | Failure<F>

type Success<S> = {
  readonly _kind: "Success"
  readonly value: S
}

type Failure<F extends TaggedFailure> = {
  readonly _kind: "Failure"
  readonly _tag: F["_tag"]
  readonly failure: F
}

type TaggedFailure<Tag extends string = string> = {
  readonly _tag: Tag
}
```

The duplicated `_tag` on the failure envelope is intentional. It gives the
boundary message a stable discriminator while preserving the original failure
object in `failure`. `Result.isResult` checks that the envelope tag and payload
tag match.

## Failures Are Actionable

A `Failure` is an expected application state the caller can handle and should
handle. It is an actionable application error state.

Any kind of error can be actionable depending on the use case: validation,
authorization, missing resources, rate limits, network timeouts, or unavailable
infrastructure can all be modeled as `Failure` when the caller can present a
meaningful state or recovery path.

A defect is different. A defect is non-actionable for the current operation:
programming bugs, impossible states, unhandled runtime errors, protocol
violations, and other conditions the caller cannot honestly recover from. Those
should usually travel through the runtime or framework error path with telemetry
and logging.

In other words:

- return `Result.Failure(...)` for actionable states the caller can handle
- throw for non-actionable defects the current operation cannot recover from

## Creating Results

```ts
import { Result, type ResultType, type TaggedFailure } from "@codeva-dev/typed-result"

type Todo = {
  readonly id: string
  readonly title: string
}

type TodoNotFound = TaggedFailure<"TodoNotFound"> & {
  readonly todoId: string
  readonly message: string
}

const success = Result.Success<Todo>({
  id: "todo-1",
  title: "Ship typed boundaries",
})

const failure = Result.Failure({
  _tag: "TodoNotFound",
  todoId: "todo-1",
  message: "Todo does not exist",
} as const)

declare const result: ResultType<Todo, TodoNotFound>
```

For inline failures, `Result.Failure(tag, fields)` creates both the tagged
failure object and the failure envelope:

```ts
const result = Result.Failure("TodoLoadFailed", {
  message: "Could not load todos",
})
```

For reusable domain failures, define the failure once:

```ts
const TodoNotFound = Result.defineTaggedFailure<
  "TodoNotFound",
  { readonly todoId: string; readonly message: string }
>("TodoNotFound")

const result = Result.Failure(TodoNotFound, {
  todoId: "todo-1",
  message: "Todo does not exist",
})
```

`createTaggedFailure(tag, fields)` is available when you need only the failure
payload object:

```ts
const failure = Result.createTaggedFailure("TodoLoadFailed", {
  message: "Could not load todos",
})

const result = Result.Failure(failure)
```

## Guards

```ts
if (Result.isResult(value)) {
  // shallow envelope check with failure tag consistency
}

if (Result.isSuccess(result)) {
  result.value
}

if (Result.isFailure(result)) {
  result.failure
  result._tag
}
```

`isResult` is not a schema decoder. Use the Zod or Effect Schema adapter when a
boundary payload needs runtime validation.

## Transforming

The API uses explicit channel names.

```ts
Result.mapSuccess(result, (todo) => todo.title)
// Success<S> -> Success<NextS>
// Failure<F> -> Failure<F>
```

```ts
Result.mapFailure(result, (failure) =>
  Result.createTaggedFailure("TodoLoadFailed", {
    message: failure._tag,
  })
)
// Success<S> -> Success<S>
// Failure<F> -> Failure<NextF>
```

Tag-specific mapping changes only selected failure tags. Unmatched failures
remain in the failure union.

```ts
Result.mapFailureTag(result, "TodoNotFound", (failure) =>
  Result.createTaggedFailure("TodoLoadFailed", {
    message: failure.message,
  })
)
```

```ts
Result.mapFailureTags(result, ["TodoNotFound", "TodoArchived"] as const, (failure) =>
  Result.createTaggedFailure("TodoUnavailable", {
    message: failure.message,
  })
)
```

Use `flatMapSuccess` when the success callback returns a new `Result` and may
switch to failure:

```ts
Result.flatMapSuccess(result, (todo) =>
  todo.title.length > 0
    ? Result.Success(todo)
    : Result.Failure("InvalidTodo", { message: "Missing title" })
)
```

Use `flatMapFailure` when the failure callback returns a new `Result` and may
recover:

```ts
Result.flatMapFailure(result, () =>
  Result.Success({
    id: "fallback",
    title: "Fallback todo",
  })
)
```

Tag-specific flat mapping is available too:

```ts
Result.flatMapFailureTag(result, "TodoNotFound", () =>
  Result.Success({
    id: "fallback",
    title: "Fallback todo",
  })
)
```

```ts
Result.flatMapFailureTags(result, ["TodoNotFound", "TodoArchived"] as const, (failure) =>
  Result.Failure("TodoUnavailable", {
    message: failure.message,
  })
)
```

## Tapping

```ts
Result.tapSuccess(result, (todo) => {
  console.log(todo.id)
})

Result.tapFailure(result, (failure) => {
  console.error(failure._tag)
})

Result.tap(result, (result) => {
  console.log(result._kind)
})
```

## Matching

`match` exits the `Result` and returns a normal value.

```ts
const viewModel = Result.match(result, {
  onSuccess: (todo) => ({
    status: "ready" as const,
    todo,
  }),
  onFailure: (failure) => {
    switch (failure._tag) {
      case "TodoNotFound":
        return { status: "missing" as const, message: failure.message }
      case "TodoLoadFailed":
        return { status: "failed" as const, message: failure.message }
    }
  },
})
```

Tag-specific terminal matching is useful when one branch has special behavior:

```ts
const message = Result.matchFailureTag(result, "TodoNotFound", {
  onMatch: (failure) => `Missing todo: ${failure.todoId}`,
  orElse: () => "Could not load todo",
})
```

```ts
const message = Result.matchFailureTags(result, ["TodoNotFound", "TodoArchived"] as const, {
  onMatch: (failure) => failure.message,
  orElse: () => "Could not load todo",
})
```

## Handle

`handle(result)` is a small branch-handler builder. `onSuccess` and `onFailure`
callbacks return a new `Result`.

```ts
const value = Result.handle(Result.Success(1))
  .onSuccess((value) =>
    value > 0
      ? Result.Success(value + 1)
      : Result.Failure("InvalidNumber", { message: "Must be positive" })
  )
  .onFailure((failure) => {
    switch (failure._tag) {
      case "InvalidNumber":
        return Result.Success(0)
    }
  })
  .unwrap()
```

`handle` can tap the current result without changing it:

```ts
Result.handle(result)
  .tapSuccess((todo) => {
    console.log(todo.id)
  })
  .tapFailure((failure) => {
    console.error(failure._tag)
  })
  .tap((result) => {
    console.log(result._kind)
  })
  .result()
```

It also exposes terminal helpers:

```ts
const title = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .unwrapOr("Untitled")
```

```ts
const optionalTitle = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .unwrapOrNull()
```

```ts
const viewModel = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .match({
    onSuccess: (title) => ({ status: "ready" as const, title }),
    onFailure: (failure) => ({ status: "failed" as const, failure }),
  })
```

Tag-specific failure matches are terminal:

```ts
const message = Result.handle(result).matchFailureTag("TodoNotFound", {
  onMatch: (failure) => `Missing todo: ${failure.todoId}`,
  orElse: () => "Could not load todo",
})
```

```ts
const message = Result.handle(result).matchFailureTags(
  ["TodoNotFound", "TodoArchived"] as const,
  {
    onMatch: (failure) => failure.message,
    orElse: () => "Could not load todo",
  },
)
```

Use `result()` when you want to keep the envelope:

```ts
const next = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .result()
```

## Unwrapping

```ts
Result.unwrap(Result.Success(1))
// 1
```

`unwrap` throws `ResultUnwrapError` for failures.

```ts
Result.unwrapOr(result, "fallback")

Result.unwrapOrNull(result)

Result.unwrapOrUndefined(result)

Result.unwrapOrElse(result, (failure) => failure._tag)
```

## React Helpers

React helpers are exported from `@codeva-dev/typed-result/react`.

```tsx
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
```

### `useResult`

`useResult` is strict: it accepts only a typed `Result`, not unknown input. It
projects the result into a discriminated state object for programmatic React
logic.

Use it for disabled states, analytics, toast logic, conditional classes,
derived labels, optimistic UI decisions, or other component logic that should
branch on the result channel.

```tsx
const state = useResult(result)

if (state.channel === "success") {
  state.data
  state.result
}

if (state.channel === "failure") {
  state.failure
  state.failureTag
  state.result
}
```

Return type:

```ts
type UseResultReturn<R> =
  | {
      readonly channel: "success"
      readonly data: SuccessOf<R>
      readonly failure: undefined
      readonly failureTag: undefined
      readonly isSuccess: true
      readonly isFailure: false
      readonly result: Extract<R, SuccessType<unknown>>
    }
  | {
      readonly channel: "failure"
      readonly data: undefined
      readonly failure: FailureOf<R>
      readonly failureTag: FailureOf<R>["_tag"]
      readonly isSuccess: false
      readonly isFailure: true
      readonly result: Extract<R, FailureType<TaggedFailure>>
    }
```

`useResult` intentionally does not have an invalid branch. Unknown boundary
payloads should be decoded or checked before they reach this hook. For render
boundaries that may receive unknown data, use `Match` with `onInvalid` or
`throwOnInvalid`.

### `Match`

`Match` is a render boundary helper.

```tsx
import { Match } from "@codeva-dev/typed-result/react"

<Match
  result={data}
  onSuccess={(todo) => <TodoView todo={todo} />}
  onFailure={(failure) => <ErrorView failure={failure} />}
  onInvalid={() => <div>Invalid result payload</div>}
/>
```

Use `throwOnInvalid` when invalid payloads should go to the React/framework
error boundary:

```tsx
<Match
  result={data}
  throwOnInvalid
  onSuccess={(todo) => <TodoView todo={todo} />}
  onFailure={(failure) => <ErrorView failure={failure} />}
/>
```

### `MatchFailureTags`

Use `MatchFailureTags` inside `onFailure` when rendering by failure `_tag`.
`MatchFailureTag` is also exported as a singular alias.

```tsx
import { Match, MatchFailureTags } from "@codeva-dev/typed-result/react"

<Match
  result={data}
  onSuccess={(todos) => <TodoList todos={todos} />}
  onFailure={(failure) => (
    <MatchFailureTags
      failure={failure}
      tags={{
        TodoNotFound: (failure) => <div>{failure.message}</div>,
        TodoLoadFailed: (failure) => <div>{failure.message}</div>,
        default: (failure) => <div>Unknown failure: {failure._tag}</div>,
      }}
    />
  )}
/>
```

## Schema Adapters

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

### Zod

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

### Effect Schema

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

### TanStack Start With Zod

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

### TanStack Start With Effect Schema

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

Schema adapter notes:

- `success` and `failure` can be a single schema descriptor or an array.
- Failure schemas are always tagged.
- Descriptor-level `Failure(fields)` and `make(fields)` are field-typed.
- Result-schema-level `Failure(tag, fields)` validates at runtime by tag.
- Decode and encode errors are protocol errors. They throw unless you
  explicitly map invalid payloads into a domain failure with `onInvalid:
  "failure"`.

## TanStack Start Examples

TanStack Start server functions are serializable boundaries. Returning
`Result.Success(...)` or `Result.Failure(...)` from the server function keeps
expected application failures in the value channel, so loaders, Query functions,
and components can handle them deliberately.

### Server Function

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

### Loader With `ensureQueryData`

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

### Direct Loader Handling

Sometimes a route should directly call the server function in the loader and
decide which failures are recoverable for that route.

```ts
import { createFileRoute, notFound } from "@tanstack/react-router"
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

## Hono HTTP API + React + TanStack Query

This example uses Hono as a plain HTTP boundary and TanStack Query in a React
client. The API returns a schema-encoded `Result`, and the React app decodes the
payload before rendering.

### Shared Schema

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

### Hono API

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

### React Query Client

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

### TanStack Router Loader

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

## Package Exports

```ts
import { Result } from "@codeva-dev/typed-result"
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
import { Result as ZodResult, z } from "@codeva-dev/typed-result/zod"
import { Result as EffectResult, Schema } from "@codeva-dev/typed-result/effect"
```

The `/zod` and `/effect` subpaths re-export the core API and add
schema-aware helpers. The main package stays framework-independent.
