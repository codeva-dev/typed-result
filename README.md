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
```

## Playgrounds

This repository keeps playgrounds separate from the publishable package:

- `playground/tanstack-start-todo`: TanStack Start + TanStack Query todo example
- `playground/hono-api`: Hono REST API for the HTTP boundary example
- `playground/hono-client`: TanStack Router + TanStack Query client for the Hono API

```sh
npm run playground:start:dev
npm run playground:hono:api
npm run playground:hono:client
npm run playground:build
```

## Development

```sh
npm install
npm run release:check
```

Alpha release helpers:

```sh
npm run version:alpha
npm run publish:alpha
```
