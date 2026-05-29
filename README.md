# typed-result

This repository contains `@codeva-dev/typed-result`, a serializable typed Result
model for TypeScript boundary responses.

The package is designed for values that cross JSON, HTTP, server functions,
RPC-like calls, SSR loaders, caches, storage, workers, queues, CLI output,
AI-to-AI messages, or any other serializable channel.

## Package

- Package: `@codeva-dev/typed-result`
- npm: https://www.npmjs.com/package/@codeva-dev/typed-result
- Source: [packages/typed-result](./packages/typed-result)
- Documentation: [packages/typed-result/README.md](./packages/typed-result/README.md)

## Install

```sh
npm install @codeva-dev/typed-result
```

## Exports

```ts
import { Result } from "@codeva-dev/typed-result"
import { Match, MatchFailureTags, useResult } from "@codeva-dev/typed-result/react"
import { Result as ZodResult, z } from "@codeva-dev/typed-result/zod"
import { Result as EffectResult, Schema } from "@codeva-dev/typed-result/effect"
```

## Development

```sh
npm install
npm run release:check
```

Release scripts use Lerna:

```sh
npm run version:alpha
npm run publish:alpha
```
