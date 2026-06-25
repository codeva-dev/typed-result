---
name: typed-result
description: Use @codeva-dev/typed-result in TypeScript apps. Trigger for serializable Result boundaries, tagged failures, Result matching, React Result rendering, Zod/Effect Schema Result decoding, and Effect Exit to Result conversion.
---

# typed-result

Use this skill to apply `@codeva-dev/typed-result` in application code.

## Rules

- Use `Result` envelopes when the operation is the protocol: server functions, RPC handlers, worker messages, queues, SSR loaders, cached payloads, localStorage, or AI-to-AI messages.
- Use normal HTTP status codes for conventional REST APIs; convert to `Result` in a client adapter only when typed UI branching helps.
- Put only actionable public application states in `Result.Failure`.
- Let defects, impossible states, invalid protocol payloads, and non-recoverable infrastructure failures throw.
- Keep failures tagged and serializable. `Result.Failure` is not an arbitrary error container.
- Prefer `Result.defineTaggedFailure(...)` for reusable public failure DTOs.
- Prefer `Result.match(...)`, `Result.isSuccess(...)`, and `Result.isFailure(...)` over manual `_kind` branching.
- Validate unknown boundary payloads with the Zod or Effect schema subpath before trusting them.
- Use React helpers only for already-created or decoded Result values.
- At Effect execution boundaries, convert from `Exit` and explicitly whitelist public Effect error tags.

## Imports

```ts
import { Result, type ResultType } from '@codeva-dev/typed-result';
import { Match } from '@codeva-dev/typed-result/react';
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/zod';
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
```

Choose only the subpath needed for the current file.

## Core Pattern

```ts
const TodoNotFound = Result.defineTaggedFailure<
	'TodoNotFound',
	{ readonly todoId: string; readonly message: string }
>('TodoNotFound');

type Todo = { readonly id: string; readonly title: string };
type TodoNotFoundFailure = ReturnType<typeof TodoNotFound.make>;

function getTodo(todoId: string): ResultType<Todo, TodoNotFoundFailure> {
	return todoId === 'todo-1'
		? Result.Success({ id: todoId, title: 'Ship typed boundaries' })
		: Result.Failure(TodoNotFound, {
				todoId,
				message: 'Todo does not exist',
			});
}

const label = Result.match(getTodo('todo-1'), {
	onSuccess: (todo) => todo.title,
	onFailure: (failure) => failure.message,
});
```

Inline one-off failures are acceptable for local-only cases:

```ts
Result.Failure('TodoLoadFailed', { message: 'Could not load todos' });
```

## Effect Boundary

Produce an `Exit`, then map only the public Effect error tags into Result failures:

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
import { Effect, Runtime, Schema } from 'effect';

class MeetingAlreadyRequested extends Schema.TaggedError<MeetingAlreadyRequested>()('MeetingAlreadyRequested', {
	message: Schema.String,
	requestId: Schema.String,
}) {}

const exit = await Runtime.runPromiseExit(runtime)(command);

return Result.fromExit(exit, {
	onError: {
		MeetingAlreadyRequested: ResultSchema.fromTaggedError(MeetingAlreadyRequested),
	},
});
```

Semantics to preserve:

- success exit -> `Result.Success`
- whitelisted typed Effect failure -> `Result.Failure`
- unlisted typed Effect failure -> throw
- `die`, interrupt, mixed fail+die, unknown cause, or multiple cause -> throw

For Effect/domain errors with `cause?: unknown`, expose only public serializable fields in the Result failure DTO.

## Zod Decode

Use schemas when JSON crosses a boundary and the receiving side must validate the Result envelope:

```ts
const TodoResult = ResultSchema.Result({
	Success: TodoSchema,
	Failure: [ResultSchema.TaggedFailure('TodoNotFound', { todoId: z.string(), message: z.string() })],
});

const result = TodoResult.decode(await response.json());
```

## React

Render with typed helpers instead of manual envelope branching:

```tsx
<Match
	result={result}
	onSuccess={(todo) => <h1>{todo.title}</h1>}
	onFailure={{
		TodoNotFound: (failure) => <p>{failure.message}</p>,
	}}
/>
```

If a Result cannot fail, do not invent an `onFailure` branch.
