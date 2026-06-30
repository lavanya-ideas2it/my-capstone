import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    globals: true,
    environment: "node",
    // The integration suite shares one test database; run files sequentially
    // so per-file data cleanup never races against another file.
    fileParallelism: false,
    setupFiles: ["tests/setup-env.ts"],
    globalSetup: ["tests/global-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      // SPEC §5: CI fails the build below 80% line AND branch coverage.
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
