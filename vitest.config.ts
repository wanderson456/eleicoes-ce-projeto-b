import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/domain/**/*.ts",
        "src/repositories/**/*.ts",
        "src/services/**/*.ts",
        "src/controllers/**/*.ts"
      ],
      exclude: [
          "src/domain/vote-repository.ts"
      ],
      reporter: ["text", "html"],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    }
  }
});
