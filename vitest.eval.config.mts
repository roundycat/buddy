import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Offline safety evaluation (npm run eval:safety). Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    reporters: ["default"],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "server-only": path.resolve(root, "./src/test/stubs/server-only.ts"),
    },
  },
});
