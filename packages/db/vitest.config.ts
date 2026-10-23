import { defineConfig } from "vitest/config";

/** DB tests create their own databases; run files one after another to keep load low. */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
