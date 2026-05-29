# typed-result Todo Manager Playground

Small TanStack Start example for `@codeva-dev/typed-result`.

It demonstrates:

- TanStack Start `createServerFn`
- TanStack Query `queryFn` calling the server function directly
- route loader preloading through `queryClient.ensureQueryData`
- rendering a serializable `Result` with `Match` and `MatchFailureTags`
- handling mutation results with `Result.handle(...).tapSuccess(...)`

## Run

From the repository root:

```sh
npm run playground:dev
```

Or from this directory:

```sh
npm run dev
```

## Build

From the repository root:

```sh
npm run playground:build
```

Or from this directory:

```sh
npm run build
```

## Important Files

- `src/server-functions/todos.ts`: in-memory Todo server functions returning `Result`
- `src/routes/index.tsx`: TanStack Query + React rendering example
- `src/routes/__root.tsx`: Query provider and root route shell
