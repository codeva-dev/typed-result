# @codeva-dev/typed-result

A serializable typed Result model for boundary responses.

`@codeva-dev/typed-result` gives TypeScript applications a small plain-data
response shape for values that cross JSON, HTTP, server functions, RPC-like
calls, SSR loaders, caches, storage, workers, queues, CLI output, AI-to-AI
messages, or any other serializable channel.

It is designed for actionable application failures: states the caller can
handle deliberately instead of losing them as `unknown`, thrown framework
errors, or ad-hoc response objects.

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

## Documentation

- [Core API](./docs/core.md)
- [React helpers](./docs/react.md)
- [Schema adapters](./docs/schema-adapters.md)
- [TanStack Start examples](./docs/tanstack-start.md)
- [Hono HTTP API + React + TanStack Query example](./docs/hono-tanstack-query.md)

## Package Exports

```ts
import { Result } from "@codeva-dev/typed-result"
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
import { Result as ZodResult, z } from "@codeva-dev/typed-result/zod"
import { Result as EffectResult, Schema } from "@codeva-dev/typed-result/effect"
```

The `/zod` and `/effect` subpaths re-export the core API and add
schema-aware helpers. The main package stays framework-independent.
