import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.tsx",
    zod: "src/zod.ts",
    effect: "src/effect.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true
})
