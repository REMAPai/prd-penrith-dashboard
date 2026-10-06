import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("create table if not exists _migrations (name text primary key, at timestamptz not null default now())");
const dir = join(process.cwd(), "db", "migrations");
for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
  const done = await client.query("select 1 from _migrations where name = $1", [f]);
  if (done.rowCount) continue;
  await client.query("begin");
  try {
    await client.query(readFileSync(join(dir, f), "utf8"));
    await client.query("insert into _migrations (name) values ($1)", [f]);
    await client.query("commit");
    console.log("applied", f);
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
await client.end();
