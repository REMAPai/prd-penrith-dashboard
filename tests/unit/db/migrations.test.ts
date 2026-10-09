import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ROLE_LABEL } from "@/lib/roles";
import { STAGES } from "@/lib/stages";

const root = process.cwd();
const dir = join(root, "db", "migrations");
const REMOVAL = "009_remove_previous_playbook_rows.sql";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = (f: string) => readFileSync(join(dir, f), "utf8");
const all = files.map(sql).join("\n");
const stripComments = (s: string) => s.replace(/--.*$/gm, "");
const statements = (s: string) => stripComments(s).split(";").map((x) => x.trim()).filter(Boolean);

describe("migration files", () => {
  it("exist and are numbered 001, 002, ... without gaps, in sorted order", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
    files.forEach((f, i) => expect(f).toMatch(new RegExp(`^${String(i + 1).padStart(3, "0")}_[a-z0-9_]+\\.sql$`)));
  });

  it("are never empty", () => {
    for (const f of files) expect(statements(sql(f)).length, f).toBeGreaterThan(0);
  });
});

describe("migrations are idempotent", () => {
  for (const f of files) {
    describe(f, () => {
      const stmts = statements(sql(f));
      it("create table / index statements use if not exists", () => {
        for (const s of stmts.filter((x) => /^create\s+(unique\s+)?(table|index)/i.test(x))) expect(s, s.slice(0, 60)).toMatch(/if not exists/i);
      });
      it("add column statements use if not exists", () => {
        for (const s of stmts.filter((x) => /add\s+column/i.test(x))) expect(s, s.slice(0, 60)).toMatch(/add\s+column\s+if not exists/i);
      });
      it("reference-data inserts use on conflict", () => {
        for (const s of stmts.filter((x) => /^insert\s+into/i.test(x))) expect(s, s.slice(0, 60)).toMatch(/on conflict/i);
      });
      it("never destroys data (the one approved removal has its own tests below)", () => {
        for (const s of f === REMOVAL ? [] : stmts) {
          expect(s, s.slice(0, 60)).not.toMatch(/^\s*(truncate|delete\s+from)/i);
          if (/^\s*drop\s/i.test(s)) expect(s).toMatch(/if exists/i);
        }
      });
      it("contains no credentials", () => {
        expect(sql(f)).not.toMatch(/\$2[aby]\$|password\s*=\s*'|api[_-]?key\s*=|secret\s*=\s*'/i);
      });
    });
  }
});

describe("schema content", () => {
  it("defines every table the application queries", () => {
    for (const t of ["companies", "branches", "users", "audit_log", "pipeline_sites", "pipeline_events", "tasks", "feedback", "progress_items", "tenants"]) {
      expect(all, t).toMatch(new RegExp(`create table if not exists ${t}\\b`, "i"));
    }
  });

  it("restricts users.role to exactly the roles the app knows", () => {
    const m = /role text not null check \(role in \(([^)]*)\)\)/i.exec(all)!;
    const roles = m[1].split(",").map((r) => r.trim().replace(/'/g, "")).sort();
    expect(roles).toEqual(Object.keys(ROLE_LABEL).sort());
  });

  it("restricts pipeline stage to the number of stages in the app", () => {
    expect(all).toMatch(new RegExp(`stage int not null default 0 check \\(stage between 0 and ${STAGES.length - 1}\\)`, "i"));
  });

  it("keeps user emails unique and Microsoft object ids unique", () => {
    expect(all).toMatch(/email text not null unique/i);
    expect(all).toMatch(/entra_oid text unique/i);
  });

  it("defaults pipeline zoning to TBC and unconfirmed", () => {
    expect(all).toMatch(/zoning text not null default 'TBC'/);
    expect(all).toMatch(/zoning_confirmed boolean not null default false/);
  });

  it("defaults new sites and tasks safely (real, not sample; not done)", () => {
    expect(all).toMatch(/is_sample boolean not null default false/);
    expect(all).toMatch(/done boolean not null default false/);
  });

  it("maps the REMAP and PRD tenants to their email domains", () => {
    const t = sql(files.find((f) => f.includes("tenants"))!);
    expect(t).toMatch(/'platform'[\s\S]*\{remap\.ai\}/);
    expect(t).toMatch(/'company'[\s\S]*\{prd\.net\.au\}/);
    expect(t).toMatch(/kind text not null check \(kind in \('platform','company'\)\)/);
  });

  it("only seeds the PRD tenant if the PRD company exists", () => {
    expect(sql(files.find((f) => f.includes("tenants"))!)).toMatch(/where exists \(select 1 from companies where id = 'prd'\)/);
  });
});

describe("scripts/seed.mjs", () => {
  const seed = readFileSync(join(root, "scripts", "seed.mjs"), "utf8");

  it("never embeds a password; the admin password comes from the environment", () => {
    expect(seed).toContain("process.env.SEED_ADMIN_PASSWORD");
    expect(seed).not.toMatch(/bcrypt\.hash\(\s*["'`]/);
  });

  it("is re-runnable: inserts use on conflict or are guarded by a count", () => {
    expect(seed).toMatch(/into companies[\s\S]*on conflict \(id\) do nothing/);
    expect(seed).toMatch(/into branches[\s\S]*on conflict \(id\) do nothing/);
    expect(seed).toMatch(/into users[\s\S]*on conflict \(email\) do update/);
    expect(seed).toMatch(/from progress_items`\)/);
  });

  it("seeds only known roles and inserts no pipeline rows: sites arrive from the weekly feed", () => {
    for (const m of seed.matchAll(/"(platform_admin|company_admin|branch_admin|marketing|agent|viewer)"/g)) expect(Object.keys(ROLE_LABEL)).toContain(m[1]);
    expect(seed).not.toMatch(/insert into pipeline_sites/);
    expect(seed).not.toContain('"SAMPLE/"');
  });

});

describe("Development Playbook migrations", () => {
  const schema = sql("008_development_playbook.sql");
  const removal = sql(REMOVAL);

  it("008 adds the sheet's missing columns, the weekly tables and one key per application, idempotently", () => {
    expect(schema).toMatch(/add column if not exists action_taken/);
    expect(schema).toMatch(/create table if not exists playbook_weeks/);
    expect(schema).toMatch(/create table if not exists playbook_week_items/);
    expect(schema).toMatch(/create table if not exists playbook_companies/);
    expect(schema).toMatch(/create unique index if not exists pipeline_sites_application[\s\S]*\(branch_id, da_type, da_number\)/);
  });

  it("008 lets a row have no priority, because the sheet has none, and renames the project", () => {
    expect(schema).toMatch(/alter column priority drop not null/);
    expect(schema).toMatch(/update progress_items set project = 'Development Playbook' where project = 'Development Pipeline'/);
  });

  it("009 only removes rows the earlier loads created, never rows from the weekly feed", () => {
    const deletes = statements(removal).filter((x) => /^delete\s+from/i.test(x));
    expect(deletes).toHaveLength(2);
    expect(deletes[0]).toMatch(/delete from pipeline_sites\s+where is_sample = true\s+or site_kind = 'listing'\s+or source in \('PlanningAlerts', 'Planning Alerts \(Penrith City Council\)', 'REA'\)/);
    expect(deletes[0]).not.toMatch(/NSW Planning Portal/);
    expect(deletes[1]).toMatch(/delete from progress_items\s+where project = 'Development Playbook'/);
    for (const d of deletes) expect(d, d.slice(0, 40)).toMatch(/\bwhere\b/i);
    expect(removal).not.toMatch(/truncate|drop\s/i);
  });
});

describe("scripts/migrate.mjs", () => {
  async function run(applied: string[], failOn?: string) {
    vi.resetModules();
    const queries: string[] = [];
    const client = {
      connect: vi.fn(),
      end: vi.fn(),
      query: vi.fn(async (q: string, p?: unknown[]) => {
        queries.push(q.trim().split(/\s+/).slice(0, 3).join(" "));
        if (/select 1 from _migrations/.test(q)) return { rowCount: applied.includes(String(p![0])) ? 1 : 0 };
        if (failOn && q === sql(failOn)) throw new Error("bad sql");
        return { rowCount: 0 };
      }),
    };
    vi.doMock("pg", () => ({ default: { Client: class { constructor() { return client; } } } }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let error: unknown;
    try {
      await import("../../../scripts/migrate.mjs");
    } catch (e) {
      error = e;
    }
    return { client, queries, log, error };
  }

  it("applies each pending migration in a transaction and records it", async () => {
    const { client, queries, log } = await run([]);
    expect(queries[0]).toBe("create table if");
    expect(queries.filter((q) => q === "begin")).toHaveLength(files.length);
    expect(queries.filter((q) => q === "commit")).toHaveLength(files.length);
    expect(client.query).toHaveBeenCalledWith("insert into _migrations (name) values ($1)", [files[0]]);
    expect(log.mock.calls.map((c) => c[1])).toEqual(files);
    expect(client.end).toHaveBeenCalled();
  });

  it("skips migrations that are already recorded", async () => {
    const { queries, log } = await run(files);
    expect(queries).not.toContain("begin");
    expect(log).not.toHaveBeenCalled();
  });

  it("rolls back and stops when a migration fails", async () => {
    const { queries, error } = await run([], files[0]);
    expect(String(error)).toContain("bad sql");
    expect(queries).toContain("rollback");
    expect(queries).not.toContain("commit");
  });
});
