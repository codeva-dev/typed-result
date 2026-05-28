# Core API

`@codeva-dev/typed-result` models boundary responses as plain serializable data:

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

## TanStack Loader Example

```ts
import { createFileRoute, redirect } from "@tanstack/react-router"
import { getTodo } from "~/server-functions/todos"
import { Result } from "@codeva-dev/typed-result"

export const Route = createFileRoute("/todos/$todoId")({
  loader: async ({ params }) => {
    const result = await getTodo({ data: { todoId: params.todoId } })

    return Result.match(result, {
      onSuccess: (todo) => todo,
      onFailure: (failure) => {
        switch (failure._tag) {
          case "TodoNotFound":
            throw redirect({ to: "/todos" })
          case "TodoLoadFailed":
            return { id: "fallback", title: failure.message }
        }
      },
    })
  },
})
```
