# React Helpers

React helpers are exported from `@codeva-dev/typed-result/react`.

```tsx
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
```

## `useResult`

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

## `Match`

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

## `MatchFailureTags`

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

## TanStack Query Component Example

This example assumes the query function returns a `Result` from a TanStack Start
server function.

```tsx
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
