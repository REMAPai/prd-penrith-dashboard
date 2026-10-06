import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import pg from "pg";
import { AUTH_DIR, AUTH_SECRET, E2E_PASSWORD, E2E_USERS, RUN_FILE, stateFile } from "./constants";

function assertThrowaway(url: string) {
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL. The e2e suite writes data and needs its own database.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && process.env.E2E_ALLOW_REMOTE_DB !== "1") {
    throw new Error(`Refusing to run e2e against non-local database host "${host}". Set E2E_ALLOW_REMOTE_DB=1 only for a database made for tests.`);
  }
}

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  assertThrowaway(url);

  const env = { ...process.env, DATABASE_URL: url, SEED_ADMIN_PASSWORD: E2E_PASSWORD };
  execFileSync(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/seed.mjs"], { env, stdio: "inherit" });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const hash = await bcrypt.hash(E2E_PASSWORD, 4);
    for (const u of E2E_USERS) {
      await client.query(
        `insert into users (email, name, role, company_id, branch_id, password_hash, status) values ($1,$2,$3,$4,$5,$6,'active')
         on conflict (email) do update set name = excluded.name, role = excluded.role, company_id = excluded.company_id, branch_id = excluded.branch_id, password_hash = excluded.password_hash, status = 'active'`,
        [u.email, u.name, u.role, u.company, u.branch, hash],
      );
    }

    // A fresh site per run so the stage-move and zoning tests start from a known state.
    const address = `E2E Test Site ${Date.now()}`;
    await client.query(
      `insert into pipeline_sites (branch_id, address, suburb, zoning, zoning_confirmed, stage, priority, signal, source, next_step, lat, lng, is_sample)
       values ('pen', $1, 'Penrith', 'TBC', false, 0, 'M', 'E2E', 'e2e', 'Confirm zoning', -33.751, 150.694, false)`,
      [address],
    );
    await client.query(
      `insert into pipeline_sites (branch_id, address, suburb, zoning, zoning_confirmed, stage, priority, signal, source, lat, lng, is_sample)
       select 'pen', 'E2E Under Testing Row', 'Penrith', 'R3', true, 2, 'M', 'E2E', 'e2e', -33.751, 150.694, true
       where not exists (select 1 from pipeline_sites where address = 'E2E Under Testing Row')`,
    );
    await client.query(
      `insert into pipeline_sites (branch_id, address, suburb, zoning, zoning_confirmed, stage, priority, signal, source, lat, lng, is_sample)
       select 'pen', 'E2E Under Testing Row', 'Penrith', 'R3', true, 2, 'M', 'E2E', 'e2e', -33.751, 150.694, true
       where not exists (select 1 from pipeline_sites where address = 'E2E Under Testing Row')`,
    );
    // One invented conversation in the dashboard database (the live source), so the buyer pages have something to show.
    await client.query(
      `insert into buyer_conversations (conversation_id, branch_id, buyer, phone, email, property, source, agent, temperature, inspection, after_hours, started_at, last_at)
       values ('e2e-pen-0', 'pen', 'E2E Buyer', '0400 000 000', 'e2e-buyer@example.test', '1 Test Street, PENRITH', 'REA', 'E2E Agent', 'Warm', 'offered_not_answered', false, now(), now())
       on conflict (conversation_id) do nothing`,
    );
    await client.query(
      `insert into buyer_turns (conversation_id, turn, buyer_message, assistant_reply, buyer_at, reply_at)
       values ('e2e-pen-0', 1, 'Is this still available?', 'Yes, it is. Open home this Saturday.', now(), now())
       on conflict (conversation_id, turn) do nothing`,
    );
    mkdirSync(AUTH_DIR, { recursive: true });
    writeFileSync(RUN_FILE, JSON.stringify({ address, stamp: Date.now() }));
  } finally {
    await client.end();
  }

  // Signed with the test secret the web server also uses, so each role starts already signed in.
  const key = new TextEncoder().encode(AUTH_SECRET);
  for (const u of E2E_USERS) {
    const token = await new SignJWT({ email: u.email, name: u.name, role: u.role, companyId: u.company, branchId: u.branch })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(key);
    const state = {
      cookies: [{ name: "prd_session", value: token, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 8 * 3600, httpOnly: true, secure: false, sameSite: "Lax" }],
      origins: [],
    };
    writeFileSync(stateFile(u.key), JSON.stringify(state));
  }
}
