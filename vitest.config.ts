import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["packages/**/__tests__/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@icebox/shared": resolve(__dirname, "packages/shared/src"),
    },
  },
});
