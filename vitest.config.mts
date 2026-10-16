import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const r = (p: string) => path.resolve(root, p);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: r("tests/helpers/empty.ts") },
      { find: /^@tests\//, replacement: r("tests") + "/" },
      { find: /^@\//, replacement: r("src") + "/" },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/regression/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    mockReset: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 85,
        branches: 80,
        "src/lib/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
      },
    },
  },
});
