import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    react: "src/react/index.tsx",
    zod: "src/schema/zod/index.ts",
    effect: "src/schema/effect/index.ts",
    "tanstack-query": "src/tanstack-query/index.ts",
    "tanstack-query/react": "src/tanstack-query/react.ts",
    "tanstack-query/convex": "src/tanstack-query/convex.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true
})
