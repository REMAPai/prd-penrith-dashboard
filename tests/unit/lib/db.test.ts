import { beforeEach, describe, expect, it, vi } from "vitest";

const pg = vi.hoisted(() => {
  const pool = vi.fn();
  const poolQuery = vi.fn();
  return { pool, poolQuery };
});
vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(opts: unknown) {
        pg.pool(opts);
      }
      query = pg.poolQuery;
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as { __pool?: unknown }).__pool;
});

describe("db", () => {
  it("creates one small pool from DATABASE_URL, reused across imports", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://test:test@localhost/none");
    const a = await import("@/lib/db");
    vi.resetModules();
    const b = await import("@/lib/db");
    expect(pg.pool).toHaveBeenCalledTimes(1);
    expect(pg.pool).toHaveBeenCalledWith({ connectionString: "postgres://test:test@localhost/none", max: 5, connectionTimeoutMillis: 8000 });
    expect(a.pool).toBe(b.pool);
  });

  it("query returns rows and passes parameters separately from the SQL", async () => {
    pg.poolQuery.mockResolvedValue({ rows: [{ n: 1 }] });
    const { query } = await import("@/lib/db");
    expect(await query("select $1::int as n", [1])).toEqual([{ n: 1 }]);
    expect(pg.poolQuery).toHaveBeenCalledWith("select $1::int as n", [1]);
    await query("select 1");
    expect(pg.poolQuery).toHaveBeenLastCalledWith("select 1", []);
  });
});
