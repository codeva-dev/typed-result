---
name: typed-result
description: Use typed-result for serializable Result boundary contracts in TypeScript apps. Trigger when modeling tagged failures, returning Result envelopes from server functions/RPC/workers, decoding unknown Result JSON with Zod or Effect Schema, rendering Results in React, or converting Effect Exit values. Do not use for package maintenance, releases, or changing typed-result itself.
---

# typed-result

Use `@codeva-dev/typed-result` to make boundary contracts explicit: public success/failure data crosses the boundary as a serializable `Result`; defects stay on the thrown/framework error path.

## Process

1. Classify the boundary.
   - Result-envelope: server function, RPC handler, worker message, queue job, SSR loader, cache/localStorage payload, AI-to-AI message.
   - HTTP-native: conventional REST endpoint where status codes are part of the public protocol.
   - Consumer-only: UI or adapter code that receives an existing Result.
   - Effect boundary: Effect command/use-case whose `Exit` must become a Result envelope.

2. Pick the contract.
   - For Result-envelope boundaries, return `Result.Success(...)` or `Result.Failure(...)`.
   - For HTTP-native boundaries, keep HTTP status codes on the server and convert to Result in a client adapter only when typed UI branching helps.
   - For consumer-only code, validate unknown payloads before trusting them, then branch with Result helpers.
   - For Effect boundaries, run to `Exit`, whitelist public typed errors, and throw everything else.

3. Check the failure DTO.
   - Failure DTOs must be tagged, public, and serializable.
   - Put only actionable states in `Result.Failure`.
   - Omit raw causes, framework objects, unknown values, and infrastructure details.

Completion criterion: the code clearly shows which states are public failures, which states throw, and how callers branch without inspecting `_kind` manually.

## Imports

Choose one import shape per file.

```ts
import { Result, type ResultType } from '@codeva-dev/typed-result';
```

```tsx
import { Match } from '@codeva-dev/typed-result/react';
```

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/zod';
```

```ts
import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
```

## Core Pattern

Use reusable failure factories for public domain failures:

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

return Result.match(getTodo('todo-1'), {
	onSuccess: (todo) => todo.title,
	onFailure: (failure) => failure.message,
});
```

Use `Result.isSuccess(...)` or `Result.isFailure(...)` when guard-style control flow is clearer. Avoid manual `_kind` branching.

## Effect Boundary

Convert from `Exit` at runtime boundaries. Do not map every Effect error automatically.

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
- Effect Schema: use `ResultSchema.fromTaggedError(...)` to expose public serializable fields from Effect tagged errors.
- React: use `<Match />` or related helpers for already-created or decoded Results. If a Result cannot fail, do not invent an `onFailure` branch.
