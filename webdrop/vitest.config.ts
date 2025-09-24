import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.{test,spec}.ts",
      "server/**/*.{test,spec}.ts",
      "**/*.int.test.ts",
    ],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
