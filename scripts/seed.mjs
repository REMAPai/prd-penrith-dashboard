import bcrypt from "bcryptjs";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const q = (sql, params) => client.query(sql, params);

await q(`insert into companies (id, name, entra_enabled) values ('prd', 'PRD Group', true) on conflict (id) do nothing`);
const branches = [
  ["pen", "Penrith", ["Penrith", "St Marys", "Kingswood", "Werrington", "Cambridge Park", "Emu Plains", "Jamisontown", "Oxley Park", "Mulgoa", "Cranebrook", "Caddens", "Glenmore Park"]],
  ["bm", "Blue Mountains", ["Springwood", "Katoomba", "Blackheath", "Leura", "Wentworth Falls"]],
  ["gp", "Glenmore Park", ["Glenmore Park", "Mulgoa", "Regentville"]],
];
for (const [id, name, sub] of branches) {
  await q(`insert into branches (id, company_id, name, suburbs) values ($1, 'prd', $2, $3) on conflict (id) do nothing`, [id, name, sub]);
}

const pw = process.env.SEED_ADMIN_PASSWORD ? await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12) : null;
const users = [
  ["hamza@remap.ai", "Hamza Tasneem", "platform_admin", null, null],
  ["irfan@remap.ai", "Irfan Farhatullah", "platform_admin", null, null],
  ["suffyan@remap.ai", "Suffyan Ahmed", "platform_admin", null, null],
  ["zimal@remap.ai", "Zimal Aziz", "platform_admin", null, null],
  ["darren@prd.net.au", "Darren Latty", "company_admin", "prd", null],
  ["thomas.latty@prd.net.au", "Thomas Latty", "marketing", "prd", "pen"],
  ["lily@prd.net.au", "Lily Masters", "branch_admin", "prd", "pen"],
];
for (const [email, name, role, c, b] of users) {
  await q(
    `insert into users (email, name, role, company_id, branch_id, password_hash) values ($1,$2,$3,$4,$5,$6)
     on conflict (email) do update set name = excluded.name, role = excluded.role, company_id = excluded.company_id, branch_id = excluded.branch_id,
       password_hash = coalesce(excluded.password_hash, users.password_hash)`,
    [email, name, role, c, b, role === "platform_admin" || email === "darren@prd.net.au" ? pw : null],
  );
}

// Real rows: tracker v2, live test run via PlanningAlerts on 23 Jul 2026. Zoning is TBC for all of them.
// lat/lng are suburb centroids (approximate), not parcel locations.
const real = [
  ["84 Cox Avenue", "Penrith", "DA", "Lodged", "M", "DA lodged", "Strata Title Subdivision x 4 Lots. Confirm zoning and applicant via Penrith DA Tracker.", "2026-06-26", -33.751, 150.694],
  ["18 Sydney Street", "St Marys", "DA", "Lodged", "H", "DA lodged", "6 townhouses plus basement carpark. Strong target-zone candidate, confirm zoning.", "2026-06-29", -33.765, 150.775],
  ["116-132 Chain-O-Ponds Road", "Mulgoa", "DA", "Lodged", "L", "DA lodged", "Construction of a dual occupancy. Rural-fringe, check zoning before pursuing.", "2026-06-26", -33.725, 150.67],
  ["61-63 Great Western Highway", "Kingswood", "DA", "Lodged", "M", "DA lodged", "Mod to an approved Multi Dwelling Housing site. Existing MDH site, area intel only.", "2026-06-23", -33.76, 150.72],
  ["24 Hobart Street", "Oxley Park", "DA", "Lodged", "M", "DA lodged", "Strata subdivision of an existing dual occupancy into 2 lots.", "2026-06-23", -33.755, 150.79],
  ["1240-1242 Mulgoa Road", "Mulgoa", "DA", "Refused", "H", "Refusal under review", "Review of Refusal Determination for Torrens Title Subdivision x 2 Lots. Motivated-seller signal.", "2026-06-28", -33.73, 150.67],
];
const existing = await q(`select count(*)::int as n from pipeline_sites where is_sample = false`);
if (!existing.rows[0].n) {
  for (const [addr, sub, type, status, pri, sig, notes, on, lat, lng] of real) {
    await q(
      `insert into pipeline_sites (branch_id, address, suburb, zoning, zoning_confirmed, stage, priority, signal, da_type, da_status, source, assignee, next_step, notes, lat, lng, is_sample, identified_on)
       values ('pen', $1, $2, 'TBC', false, 0, $3, $4, $5, $6, 'PlanningAlerts', null, 'Confirm zoning on NSW Planning Portal Spatial Viewer', $7, $8, $9, false, $10)`,
      [addr, sub, pri, sig, type, status, notes, lat, lng, on],
    );
  }
}

// Sample rows so the pipeline and map are not empty. Flagged is_sample and shown with a Sample chip.
const sampleN = (await q(`select count(*)::int as n from pipeline_sites where is_sample = true`)).rows[0].n;
if (!sampleN) {
  const cent = { Penrith: [-33.751, 150.694], "St Marys": [-33.765, 150.775], Kingswood: [-33.76, 150.72], Werrington: [-33.757, 150.745], "Cambridge Park": [-33.74, 150.71], "Emu Plains": [-33.746, 150.66], Jamisontown: [-33.77, 150.68], "Oxley Park": [-33.755, 150.79], Cranebrook: [-33.71, 150.72], Caddens: [-33.74, 150.76] };
  const subs = Object.keys(cent);
  const streets = ["Banksia", "Wattle", "Jacaranda", "Redgum", "Coral", "Eucalypt", "River", "Station", "Park", "Hill"];
  const zones = ["R3 Medium Density", "R4 High Density", "R2 Low Density", "B4 Mixed Use"];
  const sigs = ["Refusal under review", "Adjoining lots", "Expired listing", "DA lodged"];
  const nexts = ["Confirm zoning", "Trace owner", "Send approach letter", "Book site meeting", "Review contract"];
  let seedv = 12345;
  const rnd = () => ((seedv = (seedv * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pk = (a) => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < 30; i++) {
    const sub = pk(subs), c = cent[sub], stage = Math.min(9, Math.floor(Math.pow(rnd(), 1.3) * 10)), zc = rnd() < 0.6;
    await q(
      `insert into pipeline_sites (branch_id, address, suburb, zoning, zoning_confirmed, lot_size, stage, priority, signal, da_number, source, assignee, next_step, lat, lng, is_sample, identified_on)
       values ('pen', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'Sample', $10, $11, $12, $13, true, current_date - $14::int)`,
      [Math.floor(3 + rnd() * 170) + " " + pk(streets) + " St", sub, pk(zones), zc, Math.floor(450 + rnd() * 1950) + " m2", stage, pk(["H", "M", "L"]), pk(sigs), "SAMPLE/" + (100 + i), "Sample Agent", pk(nexts), c[0] + (rnd() - 0.5) * 0.012, c[1] + (rnd() - 0.5) * 0.012, Math.floor(rnd() * 60)],
    );
  }
}

// Progress items shown on Delivery Progress. Edit in the app (platform admin) or replace with a Jira feed later.
const prog = (await q(`select count(*)::int as n from progress_items`)).rows[0].n;
if (!prog) {
  const items = [
    ["Buyer Sequencing", "ask", "Confirm ClickSend inbound rule points at our webhook", "Thomas", "This week"],
    ["Buyer Sequencing", "ask", "Name the contact category for qualified buyers", "Darren", "This week"],
    ["Buyer Sequencing", "ask", "Confirm the Hot buyer definition", "Darren", "This week"],
    ["Buyer Sequencing", "ask", "Choose where failure alerts go (Teams)", "Darren", "This week"],
    ["Development Pipeline", "ask", "Agree the must-have field list", "Darren", "Next week"],
    ["Development Pipeline", "ask", "Confirm RP Data and Cordell Connect access and cost", "Darren", "Next week"],
    ["Meta Lead Funnel", "ask", "Confirm landing-page forms feed Vault", "Thomas", "This week"],
    ["Buyer Sequencing", "shipped", "Conversation log now feeds the dashboard", null, null],
    ["Buyer Sequencing", "shipped", "Vault connection live against real listings", null, null],
    ["Development Pipeline", "shipped", "Real DAs loaded into the pipeline", null, null],
    ["Platform", "shipped", "Data-status badges on every widget", null, null],
    ["Buyer Sequencing", "blocker", "ClickSend inbound rule not set", "Thomas", "6 days"],
    ["Buyer Sequencing", "blocker", "Contact category not named", "Darren", "4 days"],
    ["Buyer Sequencing", "blocker", "Alert destination undecided", "Darren", "3 days"],
    ["Buyer Sequencing", "milestone", "Conversation log connected", null, "done"],
    ["Development Pipeline", "milestone", "Pipeline loaded with real DAs", null, "done"],
    ["Buyer Sequencing", "milestone", "Outbound send released", null, "next"],
    ["Buyer Sequencing", "milestone", "Vault listings sync", null, "next"],
    ["Platform", "milestone", "Entra sign-in for company users", null, "next"],
  ];
  for (const [project, kind, text, owner, due] of items) {
    await q(`insert into progress_items (project, kind, text, owner, due) values ($1,$2,$3,$4,$5)`, [project, kind, text, owner, due]);
  }
}

console.log("seeded");
await client.end();
