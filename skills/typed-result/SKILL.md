---
name: typed-result
description: Use typed-result for serializable Result boundaries in TypeScript apps, especially tagged failures, schema-decoded envelopes, React rendering, and Effect Exit boundaries.
---

# typed-result

Use this skill to apply `@codeva-dev/typed-result` in application code. The leading concern is the boundary: what crosses it as public data, and what stays on the thrown error path.

## Boundary Rules

- Use `Result` envelopes when the operation is the protocol: server functions, RPC handlers, worker messages, queues, SSR loaders, cached payloads, localStorage, or AI-to-AI messages.
- Use normal HTTP status codes for conventional REST APIs; convert to `Result` in a client adapter only when typed UI branching helps.
- Put only actionable public application states in `Result.Failure`.
- Let defects, impossible states, invalid protocol payloads, and non-recoverable infrastructure failures throw.

## Failure DTO Rules

- Keep failure DTOs tagged and serializable. `Result.Failure` is not an arbitrary error container.
- Prefer `Result.defineTaggedFailure(...)` for reusable public failures.
- Use inline `Result.Failure('Tag', fields)` only for one-off local failures.
- Expose only public fields in failure DTOs; omit raw causes, framework objects, and other unserializable values.

## Consumer Rules

- Use `Result.match(...)`, `Result.isSuccess(...)`, and `Result.isFailure(...)`; avoid manual `_kind` branching.
- Validate unknown boundary payloads with the Zod or Effect schema subpath before trusting them.
- Use React helpers only for already-created or decoded Result values.
- Do not invent impossible branches; if a Result cannot fail, do not add an `onFailure` handler just to satisfy a shape.

## Imports

Choose the import shape needed for the file.

Core:

```ts
import { Result, type ResultType } from '@codeva-dev/typed-result';
```

React:

```ts
import { Match } from '@codeva-dev/typed-result/react';
```

Zod:

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/zod';
```

Effect:

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
```

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

## Effect Boundary

Produce an `Exit`, then map only public Effect error tags into Result failures:

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
import { Runtime, Schema } from 'effect';

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

Preserve the semantics: success -> `Result.Success`; whitelisted typed failure -> `Result.Failure`; unlisted typed failure, `die`, interrupt, mixed fail+die, unknown cause, or multiple cause -> throw.

## Schema And React Notes

- Zod: use `ResultSchema.Result({ Success, Failure })` to decode unknown JSON Result envelopes.
- Effect Schema: use `ResultSchema.fromTaggedError(...)` when exposing public serializable fields from Effect tagged errors.
- React: use `<Match />` or related helpers for rendering decoded Results, not for validating unknown payloads.
