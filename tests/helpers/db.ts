import { vi } from "vitest";

export const query = vi.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>(async () => []);
export const poolClient = { query: vi.fn<(sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>>(async () => ({ rows: [], rowCount: 0 })), release: vi.fn() };
export const pool = {
  query: vi.fn<(sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>>(async () => ({ rows: [], rowCount: 0 })),
  connect: vi.fn(async () => poolClient),
};
export const dbMock = { query, pool };

type Route = [RegExp, unknown[] | ((params: unknown[]) => unknown[])];

/** Answer queries by matching the SQL text; anything unmatched returns no rows. */
export function routeDb(routes: Route[]) {
  query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    for (const [re, out] of routes) if (re.test(sql)) return typeof out === "function" ? out(params) : out;
    return [];
  });
}

export const sqlCalls = () => query.mock.calls.map((c) => String(c[0]));
export const callsMatching = (re: RegExp) => query.mock.calls.filter((c) => re.test(String(c[0])));
