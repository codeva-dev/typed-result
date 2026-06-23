# @codeva-dev/typed-result

A serializable typed Result model for boundary responses.

`@codeva-dev/typed-result` gives TypeScript applications a small plain-data response shape for values that cross JSON, HTTP, server functions, RPC-like calls, SSR loaders, caches, storage, workers, queues, CLI output, AI-to-AI messages, or any other serializable channel.

It is designed for actionable application failures: states the caller can handle deliberately instead of losing them as `unknown`, thrown framework errors, or ad-hoc response objects.

Result values are plain serializable data. No methods are attached to returned instances.

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

## How To Read This Package

The core package gives you the wire shape and the functions for creating, checking, transforming, matching, and unwrapping that shape. Use it when you already trust the value or when you intentionally create the value before it crosses a boundary.

The React subpath gives you render helpers for already-created Result values. It does not validate unknown payloads.

The experimental schema subpaths validate unknown Result envelopes when data comes back from a boundary. They are useful when the response itself is supposed to be a Result envelope, for example a TanStack Start server function response or an RPC-like JSON payload.

For conventional REST APIs, you usually do not need a Result schema on the server. Let the HTTP API return normal HTTP status codes and plain JSON bodies, then convert those responses into `Result.Success(...)` or `Result.Failure(...)` in a small frontend adapter.

## Install

```sh
npm install @codeva-dev/typed-result
```

Core import:

```ts
import { Result } from '@codeva-dev/typed-result';
```

The same core API is also available from `/core` when you want to be explicit:

```ts
import { Result } from '@codeva-dev/typed-result/core';
```

React helpers:

```ts
import { Match, MatchFailureTags, useResult } from '@codeva-dev/typed-result/react';
```

Experimental Zod helpers:

```sh
npm install zod
```

```ts
import { Result, unsafe_Schema } from '@codeva-dev/typed-result/zod';
```

Experimental Effect Schema helpers:

```sh
npm install effect
```

```ts
import { Result, unsafe_Schema } from '@codeva-dev/typed-result/effect';
```

## Quick Example

```ts
import { Result } from '@codeva-dev/typed-result';

const TodoNotFound = Result.defineTaggedFailure<'TodoNotFound', { readonly todoId: string; readonly message: string }>(
  'TodoNotFound',
);

const result =
  Math.random() > 0.5
    ? Result.Success({ id: 'todo-1', title: 'Ship typed boundaries' })
    : Result.Failure(TodoNotFound, {
        todoId: 'todo-1',
        message: 'Todo does not exist',
      });

const viewModel = Result.match(result, {
  onSuccess: (todo) => ({ status: 'ready' as const, todo }),
  onFailure: (failure) => {
    switch (failure._tag) {
      case 'TodoNotFound':
        return { status: 'missing' as const, message: failure.message };
    }
  },
});
```

## Boundary Styles

There are two common ways to use this package at a boundary.

### Result-Envelope Boundary

Use this when you control the protocol and want the boundary message itself to be a `Result`.

This is a good fit for TanStack Start server functions, RPC-like calls, worker messages, SSR payloads, queues, caches, localStorage, and other channels where HTTP semantics are not the main application protocol.

In this style, expected application states travel as `Result.Failure(...)`. Unexpected non-actionable defects should still throw and use the runtime or framework error path.

Create the Result envelope with the core constructors before it crosses the boundary:

```ts
return Result.Success(todo);
```

Then validate the unknown payload on the receiving side when runtime validation matters:

```ts
const result = TodoResult.decode(payload);
```

This style is usually the right choice when the call itself is the protocol: `getTodo`, `completeTodo`, `sendInvite`, `reserveBook`, and similar operation-oriented boundaries.

### HTTP-Native Boundary

Use this for public or conventional REST APIs.

In this style, the server uses normal HTTP semantics:

- `200` returns a plain success payload
- `400`, `404`, `409`, or `422` can return expected actionable error payloads
- `500` and other unexpected defects should use the framework error path

The frontend client adapter turns the HTTP response into a `Result` for UI and TanStack Query usage.

This style is usually the right choice when HTTP is intentionally part of the contract. For example, a `GET /todos/:todoId` endpoint can return `404` as an HTTP response, and the frontend can decide that this particular `404` is an actionable `TodoNotFound` failure. A `500`, invalid JSON response, or failed network request can still throw and remain in the TanStack Query error channel.

You can also return Result envelopes from HTTP endpoints if that is your chosen protocol. The important part is to keep the two decisions explicit:

- HTTP-native APIs return plain HTTP payloads and convert to `Result` in the client adapter
- Result-envelope APIs return plain `Result` payloads and validate unknown payloads separately if the receiving side needs runtime validation

## Data Shape

```ts
type Result<S, F extends TaggedFailure> = Success<S> | Failure<F>;

type Success<S> = {
  readonly _kind: 'Success';
  readonly value: S;
};

type Failure<F extends TaggedFailure> = {
  readonly _kind: 'Failure';
  readonly _tag: F['_tag'];
  readonly failure: F;
};

type TaggedFailure<Tag extends string = string, Fields extends object = {}> = {
  readonly _tag: Tag;
} & Fields;
```

The duplicated `_tag` on the failure envelope is intentional. It gives the boundary message a stable discriminator while preserving the original failure object in `failure`. `Result.isResult` checks that the envelope tag and payload tag match.

## Failures Are Actionable

A `Failure` is an expected application state the caller can handle and should handle. It is an actionable application error state.

Any kind of error can be actionable depending on the use case: validation, authorization, missing resources, rate limits, network timeouts, or unavailable infrastructure can all be modeled as `Failure` when the caller can present a meaningful state or recovery path.

A defect is different. A defect is non-actionable for the current operation: programming bugs, impossible states, unhandled runtime errors, protocol violations, and other conditions the caller cannot honestly recover from. Those should usually travel through the runtime or framework error path with telemetry and logging.

In other words:

- return `Result.Failure(...)` for actionable states the caller can handle
- throw for non-actionable defects the current operation cannot recover from

## Creating Results

```ts
import { Result, type ResultType, type TaggedFailure } from '@codeva-dev/typed-result';

type Todo = {
  readonly id: string;
  readonly title: string;
};

type TodoNotFound = TaggedFailure<
  'TodoNotFound',
  {
    readonly todoId: string;
    readonly message: string;
  }
>;

const success = Result.Success<Todo>({
  id: 'todo-1',
  title: 'Ship typed boundaries',
});

const failure = Result.Failure({
  _tag: 'TodoNotFound',
  todoId: 'todo-1',
  message: 'Todo does not exist',
} as const);

declare const result: ResultType<Todo, TodoNotFound>;
```

For inline failures, `Result.Failure(tag, fields)` creates both the tagged failure object and the failure envelope:

```ts
const result = Result.Failure('TodoLoadFailed', {
  message: 'Could not load todos',
});
```

For reusable domain failures, define the failure once:

```ts
const TodoNotFound = Result.defineTaggedFailure<'TodoNotFound', { readonly todoId: string; readonly message: string }>(
  'TodoNotFound',
);

const result = Result.Failure(TodoNotFound, {
  todoId: 'todo-1',
  message: 'Todo does not exist',
});
```

`createTaggedFailure(tag, fields)` is available when you need only the failure payload object:

```ts
const failure = Result.createTaggedFailure('TodoLoadFailed', {
  message: 'Could not load todos',
});

const result = Result.Failure(failure);
```

## Guards

```ts
if (Result.isResult(value)) {
  // shallow envelope check with failure tag consistency
}

if (Result.isSuccess(result)) {
  result.value;
}

if (Result.isFailure(result)) {
  result.failure;
  result._tag;
}
```

`isResult` is not a runtime validator for your domain payloads. It only checks the Result envelope shape and failure tag consistency. Validate unknown payloads with your schema library at the boundary when needed.

## Transforming

The API uses explicit channel names.

```ts
Result.mapSuccess(result, (todo) => todo.title);
// Success<S> -> Success<NextS>
// Failure<F> -> Failure<F>
```

```ts
Result.mapFailure(result, (failure) =>
  Result.createTaggedFailure('TodoLoadFailed', {
    message: failure._tag,
  }),
);
// Success<S> -> Success<S>
// Failure<F> -> Failure<NextF>
```

Tag-specific mapping changes only selected failure tags. Unmatched failures remain in the failure union.

```ts
Result.mapFailureTag(result, 'TodoNotFound', (failure) =>
  Result.createTaggedFailure('TodoLoadFailed', {
    message: failure.message,
  }),
);
```

```ts
Result.mapFailureTags(result, ['TodoNotFound', 'TodoArchived'] as const, (failure) =>
  Result.createTaggedFailure('TodoUnavailable', {
    message: failure.message,
  }),
);
```

Use `flatMapSuccess` when the success callback returns a new `Result` and may switch to failure:

```ts
Result.flatMapSuccess(result, (todo) =>
  todo.title.length > 0 ? Result.Success(todo) : Result.Failure('InvalidTodo', { message: 'Missing title' }),
);
```

Use `flatMapFailure` when the failure callback returns a new `Result` and may recover:

```ts
Result.flatMapFailure(result, () =>
  Result.Success({
    id: 'fallback',
    title: 'Fallback todo',
  }),
);
```

Tag-specific flat mapping is available too:

```ts
Result.flatMapFailureTag(result, 'TodoNotFound', () =>
  Result.Success({
    id: 'fallback',
    title: 'Fallback todo',
  }),
);
```

```ts
Result.flatMapFailureTags(result, ['TodoNotFound', 'TodoArchived'] as const, (failure) =>
  Result.Failure('TodoUnavailable', {
    message: failure.message,
  }),
);
```

## Tapping

```ts
Result.tapSuccess(result, (todo) => {
  console.log(todo.id);
});

Result.tapFailure(result, (failure) => {
  console.error(failure._tag);
});

Result.tap(result, (result) => {
  console.log(result._kind);
});
```

## Matching

`match` exits the `Result` and returns a normal value.

```ts
const viewModel = Result.match(result, {
  onSuccess: (todo) => ({
    status: 'ready' as const,
    todo,
  }),
  onFailure: (failure) => {
    switch (failure._tag) {
      case 'TodoNotFound':
        return { status: 'missing' as const, message: failure.message };
      case 'TodoLoadFailed':
        return { status: 'failed' as const, message: failure.message };
    }
  },
});
```

Tag-specific terminal matching is useful when one branch has special behavior:

```ts
const message = Result.matchFailureTag(result, 'TodoNotFound', {
  onMatch: (failure) => `Missing todo: ${failure.todoId}`,
  orElse: () => 'Could not load todo',
});
```

```ts
const message = Result.matchFailureTags(result, ['TodoNotFound', 'TodoArchived'] as const, {
  onMatch: (failure) => failure.message,
  orElse: () => 'Could not load todo',
});
```

## Handle

`handle(result)` is a small branch-handler builder. `onSuccess` and `onFailure` callbacks return a new `Result`.

```ts
const value = Result.handle(Result.Success(1))
  .onSuccess((value) =>
    value > 0 ? Result.Success(value + 1) : Result.Failure('InvalidNumber', { message: 'Must be positive' }),
  )
  .onFailure((failure) => {
    switch (failure._tag) {
      case 'InvalidNumber':
        return Result.Success(0);
    }
  })
  .unwrap();
```

`handle` can tap the current result without changing it:

```ts
Result.handle(result)
  .tapSuccess((todo) => {
    console.log(todo.id);
  })
  .tapFailure((failure) => {
    console.error(failure._tag);
  })
  .tap((result) => {
    console.log(result._kind);
  })
  .result();
```

It also exposes terminal helpers:

```ts
const title = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .unwrapOr('Untitled');
```

```ts
const optionalTitle = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .unwrapOrNull();
```

```ts
const viewModel = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .match({
    onSuccess: (title) => ({ status: 'ready' as const, title }),
    onFailure: (failure) => ({ status: 'failed' as const, failure }),
  });
```

Tag-specific failure matches are terminal:

```ts
const message = Result.handle(result).matchFailureTag('TodoNotFound', {
  onMatch: (failure) => `Missing todo: ${failure.todoId}`,
  orElse: () => 'Could not load todo',
});
```

```ts
const message = Result.handle(result).matchFailureTags(['TodoNotFound', 'TodoArchived'] as const, {
  onMatch: (failure) => failure.message,
  orElse: () => 'Could not load todo',
});
```

Use `result()` when you want to keep the envelope:

```ts
const next = Result.handle(result)
  .onSuccess((todo) => Result.Success(todo.title))
  .result();
```

## Unwrapping

```ts
Result.unwrap(Result.Success(1));
// 1
```

`unwrap` throws `ResultUnwrapError` for failures.

```ts
Result.unwrapOr(result, 'fallback');

Result.unwrapOrNull(result);

Result.unwrapOrUndefined(result);

Result.unwrapOrElse(result, (failure) => (failure._tag === 'SampleFailureTag' ? 'fallback' : failure._tag));
// or
Result.unwrapOrElse(result, (failure) => {
  switch (failure._tag) {
    case 'SampleFailureTag_1': {
      return 'fallback_1';
    }
    case 'SampleFailureTag_2': {
      return 'fallback_2';
    }
    default:
      failure satisfies never;
  }
});
```

## React Helpers

React helpers are exported from `@codeva-dev/typed-result/react`.

```tsx
import { Match, MatchFailureTags, useResult } from '@codeva-dev/typed-result/react';
```

### `useResult`

`useResult` is strict: it accepts only a typed `Result`, not unknown input. It projects the result into a discriminated state object for programmatic React logic.

Use it for disabled states, analytics, toast logic, conditional classes, derived labels, optimistic UI decisions, or other component logic that should branch on the result channel.

```tsx
const state = useResult(result);

if (state.channel === 'success') {
  state.data;
  state.result;
}

if (state.channel === 'failure') {
  state.failure;
  state.failureTag;
  state.result;
}
```

Return type:

```ts
type UseResultReturn<R> =
  (SuccessOf<R> extends never ? never : {
      readonly channel: 'success';
      readonly data: SuccessOf<R>;
      readonly failure: undefined;
      readonly failureTag: undefined;
      readonly isSuccess: true;
      readonly isFailure: false;
      readonly result: Extract<R, SuccessType<unknown>>;
    })
  | (FailureOf<R> extends never ? never : {
      readonly channel: 'failure';
      readonly data: undefined;
      readonly failure: FailureOf<R>;
      readonly failureTag: FailureOf<R>['_tag'];
      readonly isSuccess: false;
      readonly isFailure: true;
      readonly result: Extract<R, FailureType<TaggedFailure>>;
    });
```

`useResult` intentionally does not have an invalid branch. Unknown boundary payloads should be decoded or checked before they reach this hook. For render boundaries that may receive unknown data, use `Match` with `onInvalid` or `throwOnInvalid`.

### `Match`

`Match` is a render boundary helper.

`onSuccess` is required only when the result type can be a success. `onFailure` is required only when the result type can be a failure. For example, a `Success<T>` value can be rendered with only `onSuccess`; a `Result<T, F>` union still requires both handlers.

```tsx
import { Match } from '@codeva-dev/typed-result/react';

<Match
  result={data}
  onSuccess={(todo) => <TodoView todo={todo} />}
  onFailure={(failure) => <ErrorView failure={failure} />}
  onInvalid={() => <div>Invalid result payload</div>}
/>;
```

Use `throwOnInvalid` when invalid payloads should go to the React/framework error boundary:

```tsx
<Match
  result={data}
  throwOnInvalid
  onSuccess={(todo) => <TodoView todo={todo} />}
  onFailure={(failure) => <ErrorView failure={failure} />}
/>
```

### `MatchFailureTags`

Use `MatchFailureTags` inside `onFailure` when rendering by failure `_tag`. `MatchFailureTag` is also exported as a singular alias.

```tsx
import { Match, MatchFailureTags } from '@codeva-dev/typed-result/react';

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
/>;
```

## Experimental Zod Schema Support

Zod support is available from `@codeva-dev/typed-result/zod` and re-exports the core API. It is intentionally exposed as `unsafe_Schema` while the schema adapter API is being stabilized.

```ts
import z from 'zod/v4';
import { Result, unsafe_Schema as Schema } from '@codeva-dev/typed-result/zod';

const Todo = z.object({
  id: z.string(),
  title: z.string(),
});

const TodoNotFound = Schema.TaggedFailure('TodoNotFound', {
  todoId: Todo.shape.id,
  message: z.string(),
});

const TodoResult = Schema.Result({
  Success: Todo,
  Failure: [TodoNotFound],
});

const payload = await response.json();
const result = TodoResult.decode(payload);

return Result.match(result, {
  onSuccess: (todo) => todo.title,
  onFailure: (failure) => failure.message,
});
```

`TaggedFailure.make(...)` creates a raw tagged failure payload:

```ts
const failure = TodoNotFound.make({
  todoId: 'todo-1',
  message: 'Todo does not exist',
});

// {
//   _tag: "TodoNotFound",
//   todoId: "todo-1",
//   message: "Todo does not exist"
// }
```

Use `Result.Failure(...)` when you want to wrap that payload in a Result envelope:

```ts
return Result.Failure(
  TodoNotFound.make({
    todoId: 'todo-1',
    message: 'Todo does not exist',
  }),
);
```

`decode(...)` validates an unknown Result envelope and returns the decoded core Result object. Use this when the payload is supposed to have `{ _kind: "Success" | "Failure", ... }` shape.

It is not a replacement for parsing a plain REST response body. In an HTTP-native API, parse the body with Zod directly, then wrap that parsed value with `Result.Success(...)` or `Result.Failure(...)` in your fetch adapter.

The Zod adapter currently targets Zod v4.

`safeDecode(...)` validates an unknown Result envelope and returns a core `Result` instead of throwing. On invalid payloads, the returned failure tag is `InvalidResult`:

```ts
const decoded = Schema.safeDecode(TodoResult.Schema, payload);

Result.match(decoded, {
  onSuccess: (result) => result,
  onFailure: (failure) => {
    // failure._tag === "InvalidResult"
    return failure.message;
  },
});
```

`encode(...)` converts a decoded Result envelope back to the schema encoded shape:

```ts
const encoded = TodoResult.encode(result);
```

## Experimental Effect Schema Support

Effect Schema support is available from `@codeva-dev/typed-result/effect` and re-exports the core API. It is intentionally exposed as `unsafe_Schema` while the schema adapter API is being stabilized.

```ts
import { Effect, Schema as EffectSchema } from 'effect';
import { Result, unsafe_Schema as Schema } from '@codeva-dev/typed-result/effect';

const Todo = EffectSchema.Struct({
  id: EffectSchema.String,
  title: EffectSchema.String,
});

const TodoNotFound = Schema.TaggedFailure('TodoNotFound', {
  todoId: EffectSchema.String,
  message: EffectSchema.String,
});

const TodoResult = Schema.Result({
  Success: Todo,
  Failure: [TodoNotFound],
});
```

`TaggedFailure(...)` creates an Effect Schema tagged error wrapper. The created values are native Error instances with a stable `_tag`, but they still encode to plain wire-safe objects:

```ts
const failure = TodoNotFound.make({
  todoId: 'todo-1',
  message: 'Todo does not exist',
});

const encoded = TodoNotFound.encode(failure);
// { _tag: "TodoNotFound", todoId: "todo-1", message: "Todo does not exist" }
```

If you already use native Effect Schema `TaggedError` classes, wrap them with `fromTaggedError(...)`:

```ts
class TodoArchived extends EffectSchema.TaggedError<TodoArchived>()('TodoArchived', {
  todoId: EffectSchema.String,
  message: EffectSchema.String,
}) {}

const TodoArchivedFailure = Schema.fromTaggedError(TodoArchived);
```

Use `decode(...)` when an unknown Result envelope should become a synchronous core Result object:

```ts
const result = TodoResult.decode(payload);

return Result.match(result, {
  onSuccess: (todo) => todo.title,
  onFailure: (failure) => failure.message,
});
```

Use `decodeEffect(...)` when the decoded Result should immediately return to Effect channels. Success goes to the Effect success channel and failure goes to the Effect error channel:

```ts
const program = Effect.gen(function* () {
  const todo = yield* TodoResult.decodeEffect(payload);
  return todo.title;
});
```

For schema decode errors, `decode(...)` throws and `decodeEffect(...)` dies. Invalid protocol payloads are non-actionable defects by default because the payload does not match the declared boundary contract.

Use `safeDecode(...)` when invalid Result envelopes should be represented as a core Result instead. On invalid payloads, the returned failure tag is `InvalidResult`:

```ts
const decoded = Schema.safeDecode(TodoResult.Schema, payload);
```

### Effect Interop

The Effect subpath adds conversion helpers to the exported `Result` namespace for Effect boundary code.

`Result.Failure(...)` is a tagged failure envelope. Effect interop therefore uses an explicit `onError` whitelist at the boundary: only listed typed Effect failures are encoded into `Result.Failure(...)`; unlisted failures, defects, interruptions, unknown causes, and mixed causes throw.

Use `unsafe_Schema.TaggedFailure(...)` for Result-owned failure schemas, or `unsafe_Schema.fromTaggedError(...)` when the Effect command already models public errors with `Schema.TaggedError` classes.

The Effect API intentionally keeps runtime execution explicit. Use `Runtime.runPromiseExit(runtime)(command)` at runtime-provided boundaries, then pass the `Exit` to `Result.fromExit(...)`. The previous alpha helpers `runEffect`, `runWith`, `toFailureTag`, and `fromEffectExit` are not part of the public Effect surface.

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
import { Runtime, Schema } from 'effect';

class TodoNotFound extends Schema.TaggedError<TodoNotFound>()('TodoNotFound', {
  todoId: Schema.String,
}) {}

class CannotArchiveTodo extends Schema.TaggedError<CannotArchiveTodo>()('CannotArchiveTodo', {
  todoId: Schema.String,
}) {}
```

At an Effect execution boundary, run the command to an `Exit`, then explicitly choose which typed errors are public Result failures:

```ts
const exit = await Runtime.runPromiseExit(runtime)(archiveTodo(input));

return Result.fromExit(exit, {
  onError: {
    TodoNotFound: ResultSchema.fromTaggedError(TodoNotFound),
    CannotArchiveTodo: ResultSchema.fromTaggedError(CannotArchiveTodo),
  },
});
```

For fully provided `Effect<A, E, never>` values, `Result.fromEffect(effect, options)` runs the Effect and applies the same boundary rules:

```ts
const TodoNotFoundFailure = ResultSchema.TaggedFailure('TodoNotFound', {
  todoId: Schema.String,
});

return await Result.fromEffect(loadTodo('todo-1'), {
  onError: {
    TodoNotFound: TodoNotFoundFailure,
  },
});
```

Handler keys must match both the Effect failure `_tag` and the encoded Result failure `_tag`. The returned Result failure union is inferred only from the listed handlers:

```ts
const result = Result.fromExit(exit, {
  onError: {
    TodoNotFound: TodoNotFoundFailure,
  },
});

// Result<Success, { _tag: "TodoNotFound"; todoId: string }>
```

`Result.toEffect(result)` converts a Result envelope back into `Effect<S, F, never>`:

```ts
const todo = yield* Result.toEffect(result);
```

Effect defects are not converted into `Result.Failure(...)`. `fromEffect(...)` and `fromExit(...)` convert only a single pure typed Effect failure that has a matching `onError` handler. Defects, interruptions, unknown causes, multiple failures, unlisted failures, and mixed causes are rethrown so they can travel through the runtime/framework error path.

## Package Exports

```ts
import { Result } from '@codeva-dev/typed-result';
import { Match, MatchFailureTags, useResult } from '@codeva-dev/typed-result/react';
import { unsafe_Schema } from '@codeva-dev/typed-result/zod';
import { unsafe_Schema as EffectSchema } from '@codeva-dev/typed-result/effect';
```

The main package and `/core` are framework-independent and expose the same core Result API. React helpers live in the `/react` subpath. Experimental Zod helpers live in the `/zod` subpath. Experimental Effect Schema helpers live in the `/effect` subpath.

```ts
import { Result } from '@codeva-dev/typed-result/core';
```

## Example: Hono HTTP API With TanStack Query

Use this style when HTTP status codes are part of the API contract. The Hono API returns normal HTTP responses. The frontend fetch adapter converts expected HTTP states into `Result` values for TanStack Query.

Server:

```ts
import { Hono } from 'hono';

type Todo = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

const todos = new Map<string, Todo>([
  [
    'todo-1',
    {
      id: 'todo-1',
      title: 'Ship typed-result',
      completed: false,
    },
  ],
]);

export const app = new Hono();

app.get('/api/todos', (context) => {
  return context.json([...todos.values()]);
});

app.post('/api/todos/:todoId/complete', (context) => {
  const todoId = context.req.param('todoId');
  const todo = todos.get(todoId);

  if (!todo) {
    return context.json(
      {
        todoId,
        message: 'Todo does not exist',
      },
      404,
    );
  }

  if (todo.completed) {
    return context.json(
      {
        todoId,
        message: 'Todo is already completed',
      },
      409,
    );
  }

  const completedTodo = {
    ...todo,
    completed: true,
  };

  todos.set(todoId, completedTodo);

  return context.json(completedTodo);
});
```

Client:

```tsx
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Result, type ResultType, type TaggedFailure } from '@codeva-dev/typed-result';
import { Match } from '@codeva-dev/typed-result/react';

type Todo = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

type TodoNotFound = TaggedFailure<
  'TodoNotFound',
  {
    readonly todoId: string;
    readonly message: string;
  }
>;

type TodoAlreadyCompleted = TaggedFailure<
  'TodoAlreadyCompleted',
  {
    readonly todoId: string;
    readonly message: string;
  }
>;

type TodoCompleteFailure = TodoNotFound | TodoAlreadyCompleted;

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function fetchTodos(): Promise<ResultType<ReadonlyArray<Todo>, never>> {
  const response = await fetch('/api/todos');

  if (!response.ok) {
    throw new Error(`Todo list request failed with HTTP ${response.status}`);
  }

  return Result.Success(await parseJson<ReadonlyArray<Todo>>(response));
}

async function completeTodo(todoId: string): Promise<ResultType<Todo, TodoCompleteFailure>> {
  const response = await fetch(`/api/todos/${todoId}/complete`, {
    method: 'POST',
  });

  if (response.ok) {
    return Result.Success(await parseJson<Todo>(response));
  }

  if (response.status === 404) {
    return Result.Failure('TodoNotFound', await parseJson<Omit<TodoNotFound, '_tag'>>(response));
  }

  if (response.status === 409) {
    return Result.Failure('TodoAlreadyCompleted', await parseJson<Omit<TodoAlreadyCompleted, '_tag'>>(response));
  }

  throw new Error(`Todo complete request failed with HTTP ${response.status}`);
}

export const todosQuery = queryOptions({
  queryKey: ['todos'],
  queryFn: fetchTodos,
});

export function TodoList() {
  const queryClient = useQueryClient();
  const { data: todosResult } = useSuspenseQuery(todosQuery);

  const completeMutation = useMutation({
    mutationFn: completeTodo,
    onSuccess: (result) => {
      Result.match(result, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
        onFailure: (failure) => {
          switch (failure._tag) {
            case 'TodoNotFound':
              console.error(failure.message);
              return;
            case 'TodoAlreadyCompleted':
              console.info(failure.message);
              return;
          }
        },
      });
    },
  });

  return (
    <Match
      result={todosResult}
      onSuccess={(todos) => (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              <span>{todo.title}</span>
              <button type='button' disabled={todo.completed} onClick={() => completeMutation.mutate(todo.id)}>
                Complete
              </button>
            </li>
          ))}
        </ul>
      )}
      onFailure={() => null}
    />
  );
}
```

In this example, `404` and `409` are expected actionable application states, so the client adapter returns `Result.Failure(...)`. Network errors, invalid server behavior, and unexpected HTTP statuses throw and stay in the TanStack Query error channel.

## Example: TanStack Start Server Function With Zod Decode

Use this style when the server function itself is the boundary protocol. The server function returns a Result envelope, and the caller validates the unknown boundary payload with the experimental Zod adapter.

```ts
import { createServerFn } from '@tanstack/react-start';
import z from 'zod/v4';
import { Result, unsafe_Schema as Schema } from '@codeva-dev/typed-result/zod';

const Todo = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
});

const CompleteTodoInput = z.object({
  todoId: z.string(),
});

const TodoNotFound = Schema.TaggedFailure('TodoNotFound', {
  todoId: z.string(),
  message: z.string(),
});

const TodoAlreadyCompleted = Schema.TaggedFailure('TodoAlreadyCompleted', {
  todoId: z.string(),
  message: z.string(),
});

const CompleteTodoResult = Schema.Result({
  Success: Todo,
  Failure: [TodoNotFound, TodoAlreadyCompleted],
});

const todos = new Map<string, z.output<typeof Todo>>([
  [
    'todo-1',
    {
      id: 'todo-1',
      title: 'Ship typed-result',
      completed: false,
    },
  ],
]);

export const completeTodoServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input) => CompleteTodoInput.parse(input))
  .handler(async ({ data }) => {
    const todo = todos.get(data.todoId);

    if (!todo) {
      return Result.Failure(
        TodoNotFound.make({
          todoId: data.todoId,
          message: 'Todo does not exist',
        }),
      );
    }

    if (todo.completed) {
      return Result.Failure(
        TodoAlreadyCompleted.make({
          todoId: data.todoId,
          message: 'Todo is already completed',
        }),
      );
    }

    const completedTodo = {
      ...todo,
      completed: true,
    };

    todos.set(data.todoId, completedTodo);

    return Result.Success(completedTodo);
  });

export async function completeTodo(todoId: string) {
  const payload = await completeTodoServerFn({
    data: {
      todoId,
    },
  });

  return CompleteTodoResult.decode(payload);
}
```

Use the decoded Result in TanStack Query:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Result } from '@codeva-dev/typed-result/zod';

export function CompleteTodoButton(props: { readonly todoId: string }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => completeTodo(props.todoId),
    onSuccess: (result) => {
      Result.match(result, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
        onFailure: (failure) => {
          switch (failure._tag) {
            case 'TodoNotFound':
              console.error(failure.message);
              return;
            case 'TodoAlreadyCompleted':
              console.info(failure.message);
              return;
          }
        },
      });
    },
  });

  return (
    <button type='button' onClick={() => mutation.mutate()}>
      Complete
    </button>
  );
}
```
