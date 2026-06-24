# typed-result examples

This private workspace contains small TypeScript examples that compile against the repository root package.

```sh
npm run examples:typecheck
```

Examples:

- `src/core-result.ts`: core Result construction and matching.
- `src/zod-schema.ts`: Zod-backed Result schema decoding.
- `src/effect-boundary.ts`: Effect `Exit` boundary conversion with `Result.fromExit(...)`.
