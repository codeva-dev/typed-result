# @codeva-dev/typed-result

A serializable typed Result model for boundary responses.

`@codeva-dev/typed-result` provides a plain-data response shape for places where
values cross a serializable boundary and still need to preserve a typed
success/failure contract.

Use it for JSON payloads, HTTP APIs, server functions, RPC-like calls, SSR
loaders, TanStack Query data, storage, workers, queues, CLI output, AI-to-AI
messages, or any other channel where TypeScript values become messages.

## Install

```sh
npm install @codeva-dev/typed-result
```

For alpha releases:

```sh
npm install @codeva-dev/typed-result@alpha
```

React helpers are available from a separate subpath:

```ts
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
```

## Why This Exists

TypeScript preserves rich types inside one compilation context. Serializable
boundaries do not. Once a value crosses JSON, HTTP, storage, a worker, an SSR
payload, or a text-based channel, the receiver gets data that must be
interpreted according to a protocol.

Success payloads usually survive this well. Expected failures are harder. Most
solutions either throw, reject, return ad-hoc objects, or collapse the error
channel into `unknown`. That is painful when the caller is supposed to handle
`BookNotFound`, `AccessDenied`, `ValidationFailed`, or `RateLimited` as normal
application states.

This package defines a small shared wire shape:

- `_kind` tells whether the result is `"Success"` or `"Failure"`
- failure values also carry `_tag` for switching and rendering
- result instances are plain serializable objects
- helpers are available as named exports and on the exported `Result` namespace

## Failures Are Actionable

A `Failure` is an expected application state the caller can handle and should
handle. In that sense, a `Failure` is an actionable application error state.

Any kind of error can be actionable. A validation problem, an authorization
problem, a missing resource, a rate limit, a network timeout, or a database
connection problem can all be valid `Failure` values if the current use case,
application, and feature can present a meaningful recovery path or user-facing
state.

A defect is different. A defect is non-actionable for the current operation:
programming bugs, impossible states, unhandled runtime errors, protocol
violations, and other conditions the caller cannot honestly recover from. Those
should usually travel through the runtime or framework error path with telemetry
and logging.

In other words:

- return `Result.Failure(...)` for actionable states the caller can handle
- throw for non-actionable defects the current operation cannot recover from

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

The duplicated `_tag` on the failure envelope is intentional. It gives callers a
stable envelope-level discriminator while preserving the original failure object
inside `failure`. `isResult` checks that both tags match.

## Creating Results

```ts
import { Result, type ResultType, type TaggedFailure } from "@codeva-dev/typed-result"

type Todo = {
  readonly id: string
  readonly title: string
}

type TodoNotFound = TaggedFailure<"TodoNotFound"> & {
  readonly id: string
  readonly message: string
}

const ok = Result.Success<Todo>({
  id: "todo-1",
  title: "Ship it",
})

const failed = Result.Failure({
  _tag: "TodoNotFound",
  id: "todo-1",
  message: "Todo does not exist",
} as const)

declare const result: ResultType<Todo, TodoNotFound>
```

The values are plain data:

```ts
JSON.stringify(failed)
// {"_kind":"Failure","_tag":"TodoNotFound","failure":{"_tag":"TodoNotFound","id":"todo-1","message":"Todo does not exist"}}
```

### Failure Helpers

For inline failures, pass a tagged object directly:

```ts
Result.Failure({
  _tag: "TodoLoadFailed",
  message: "Could not load todos",
} as const)
```

For convenience, `Failure(tag, fields)` creates the tagged failure object and the
failure envelope in one call:

```ts
const failed = Result.Failure("TodoLoadFailed", {
  message: "Could not load todos",
})

failed.failure._tag
// "TodoLoadFailed"
```

If you want reusable domain failure definitions, use `defineTaggedFailure`:

```ts
const TodoNotFound = Result.defineTaggedFailure<
  "TodoNotFound",
  { readonly id: string; readonly message: string }
>("TodoNotFound")

const failed = Result.Failure(TodoNotFound, {
  id: "todo-1",
  message: "Todo does not exist",
})
```

`createTaggedFailure(tag, fields)` is also available when you need only the
failure payload object:

```ts
const failure = Result.createTaggedFailure("TodoLoadFailed", {
  message: "Could not load todos",
})

const failed = Result.Failure(failure)
```

## Guards

```ts
if (Result.isSuccess(result)) {
  result.value
}

if (Result.isFailure(result)) {
  result.failure
  result._tag
}

if (Result.isResult(value)) {
  // shallow envelope check with failure tag consistency
}
```

`isResult` validates the envelope shape. It is not a schema decoder.

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

Use tag-specific failure mapping when only selected failure tags should change.
Unmatched failure tags remain in the failure union.

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
Result.flatMapFailure(result, (failure) =>
  Result.Success({
    id: "fallback",
    title: failure._tag,
  })
)
```

Use tag-specific failure flat mapping when selected failures can recover or
switch to another failure branch.

```ts
Result.flatMapFailureTag(result, "TodoNotFound", () =>
  Result.Success({
    id: "fallback",
    title: "Fallback todo",
    completed: false,
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

Result.tap(result, (valueOrFailure) => {
  console.log(valueOrFailure)
})
```

For tag-specific behavior, use `tapFailure` and switch on `failure._tag`. A
multi-tag helper is intentionally not part of the stable API yet because the
TypeScript inference cost is not worth it for this version.

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

It also exposes fallback and matching endpoints:

```ts
const value = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .unwrapOr("Untitled")
```

```ts
const value = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .unwrapOrElse((failure) => failure._tag)
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

Tag-specific failure matches are terminal too. They are useful when one or a few
failure tags need special handling and every other result should use a fallback.

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

Use `result()` when you want to keep the `Result` envelope:

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

## React

React helpers are exported from `@codeva-dev/typed-result/react`.

### `useResult`

`useResult` is strict: it accepts only a valid typed Result, not unknown input.
It projects the result into a discriminated state object for programmatic React
logic. Use it when you need branch state outside rendering helpers: disabled
states, analytics, toast logic, conditional classes, derived labels, or other
component decisions.

```tsx
import { useResult } from "@codeva-dev/typed-result/react"

const state = useResult(result)
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
      readonly result: Extract<R, Success<unknown>>
    }
  | {
      readonly channel: "failure"
      readonly data: undefined
      readonly failure: FailureOf<R>
      readonly failureTag: FailureOf<R>["_tag"]
      readonly isSuccess: false
      readonly isFailure: true
      readonly result: Extract<R, Failure<TaggedFailure>>
    }
```

`channel` is the discriminator:

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

`useResult` intentionally does not have an invalid branch. Unknown boundary
payloads should be decoded or checked before they reach this hook. For render
boundaries that may receive unknown data, use `Match` with `onInvalid` or
`throwOnInvalid`.

### `Match`

`Match` is a render boundary helper. It can also handle invalid input through
`onInvalid` or `throwOnInvalid`.

```tsx
import { Match } from "@codeva-dev/typed-result/react"

<Match
  result={data}
  onSuccess={(todo) => <TodoView todo={todo} />}
  onFailure={(failure) => <ErrorView failure={failure} />}
  onInvalid={() => <div>Invalid result payload</div>}
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

## TanStack Start And TanStack Query

Keep transport/runtime failures in the TanStack Query error channel. Keep
expected application failures in `Result.Failure`.

### Server Function As Query Function

This pattern calls a TanStack Start server function directly from the TanStack
Query `queryFn`. The server function returns a serializable `Result`.

```tsx
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { createFileRoute } from "@tanstack/react-router"
import { Result, type ResultType, type TaggedFailure } from "@codeva-dev/typed-result"
import { Match, MatchFailureTags } from "@codeva-dev/typed-result/react"

type Todo = {
  readonly id: string
  readonly title: string
  readonly completed: boolean
}

type TodoLoadFailed = TaggedFailure<"TodoLoadFailed"> & {
  readonly message: string
}

type TodoValidationFailed = TaggedFailure<"TodoValidationFailed"> & {
  readonly message: string
}

type TodoFailure = TodoLoadFailed | TodoValidationFailed

const todos: ReadonlyArray<Todo> = [
  { id: "todo-1", title: "Ship it", completed: false },
]

const listTodos = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResultType<ReadonlyArray<Todo>, TodoFailure>> => {
    if (Math.random() > 0.8) {
      return Result.Failure("TodoLoadFailed", {
        message: "Could not load todos",
      })
    }

    if (todos.length === 0) {
      return Result.Failure("TodoValidationFailed", {
        message: "No todos are available",
      })
    }

    return Result.Success(todos)
  }
)

const todosQueryOptions = queryOptions({
  queryKey: ["todos"],
  queryFn: () => listTodos(),
})

export const Route = createFileRoute("/todos")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(todosQueryOptions),
  component: TodosRoute,
})

function TodosRoute() {
  const { data } = useSuspenseQuery(todosQueryOptions)

  return (
    <Match
      result={data}
      onSuccess={(todos) => <TodoList todos={todos} />}
      onFailure={(failure) => (
        <MatchFailureTags
          failure={failure}
          tags={{
            TodoLoadFailed: (failure) => <ErrorMessage>{failure.message}</ErrorMessage>,
            TodoValidationFailed: (failure) => <ErrorMessage>{failure.message}</ErrorMessage>,
            default: (failure) => <ErrorMessage>Unexpected failure: {failure._tag}</ErrorMessage>,
          }}
        />
      )}
      onInvalid={() => <ErrorMessage>Invalid result payload</ErrorMessage>}
    />
  )
}
```

### Direct Server Function In A Loader

You can also call the server function directly in a route loader and decide how
to handle typed failures there. This is useful when some failures should become
router errors while others can recover to loader data.

```tsx
import { createServerFn } from "@tanstack/react-start"
import { createFileRoute } from "@tanstack/react-router"
import { Result, type ResultType, type TaggedFailure } from "@codeva-dev/typed-result"

type Todo = {
  readonly id: string
  readonly title: string
  readonly completed: boolean
}

type TodoLoadFailed = TaggedFailure<"TodoLoadFailed"> & {
  readonly message: string
}

type TodoValidationFailed = TaggedFailure<"TodoValidationFailed"> & {
  readonly message: string
}

type TodoFailure = TodoLoadFailed | TodoValidationFailed

const listTodos = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResultType<ReadonlyArray<Todo>, TodoFailure>> => {
    return Result.Failure("TodoValidationFailed", {
      message: "Recoverable validation problem",
    })
  }
)

export const Route = createFileRoute("/todos-direct")({
  loader: async () => {
    const result = await listTodos()

    return Result.match(result, {
      onSuccess: (todos) => todos,
      onFailure: (failure) => {
        switch (failure._tag) {
          case "TodoLoadFailed":
            throw new Error(failure.message)

          case "TodoValidationFailed":
            return [] satisfies ReadonlyArray<Todo>
        }
      },
    })
  },
  component: TodosRoute,
})
```

The loader above:

- throws for `TodoLoadFailed`
- recovers from `TodoValidationFailed` by returning an empty todo list
- keeps the server function response serializable and typed

## Package Exports

```ts
import { Result } from "@codeva-dev/typed-result"
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
```

Schema decoders are intentionally not part of this first alpha. Effect Schema
and Zod adapters are planned for later versions.
