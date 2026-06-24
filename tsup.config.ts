import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    react: "src/react/index.tsx",
    zod: "src/schema/zod/index.ts",
    effect: "src/schema/effect/index.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true
})
