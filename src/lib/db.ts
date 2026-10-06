import pg from "pg";

const g = globalThis as unknown as { __pool?: pg.Pool };

export const pool =
  g.__pool ??
  (g.__pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 8000,
  }));

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}
