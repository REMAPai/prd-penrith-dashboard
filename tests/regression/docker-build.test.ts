import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lines = (file: string) => readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

describe("docker build context", () => {
  // Bug: .dockerignore excluded tests/ but tsconfig still type-checked playwright.config.ts, which imports ./tests/e2e/constants,
  // so `next build` failed inside Dokploy while CI (which has the full tree) passed. Every staging deploy from PR #3 on errored.
  it("excludes root config files that import from excluded directories", () => {
    const ignored = lines(".dockerignore");
    const excluded = (name: string) => ignored.some((p) => p === name || p === `${name}/`);
    for (const config of ["playwright.config.ts", "vitest.config.mts"]) {
      if (!existsSync(config)) continue;
      const imports = [...readFileSync(config, "utf8").matchAll(/from "\.\/([^"]+)"/g)].map((m) => m[1]);
      for (const imp of imports) {
        const top = imp.split("/")[0];
        if (excluded(top)) expect(excluded(config), `${config} imports ./${imp} but ${top}/ is dockerignored`).toBe(true);
      }
    }
  });

  it("still ships what the container needs at runtime", () => {
    const ignored = lines(".dockerignore");
    for (const needed of ["db", "scripts", "public", "src"]) expect(ignored).not.toContain(needed);
  });
});
