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

// Progress items shown on Delivery Progress. Edit in the app (platform admin) or replace with a Jira feed later.
const prog = (await q(`select count(*)::int as n from progress_items`)).rows[0].n;
if (!prog) {
  const items = [
    ["Buyer Sequencing", "ask", "Confirm ClickSend inbound rule points at our webhook", "Thomas", "This week"],
    ["Buyer Sequencing", "ask", "Name the contact category for qualified buyers", "Darren", "This week"],
    ["Buyer Sequencing", "ask", "Confirm the Hot buyer definition", "Darren", "This week"],
    ["Buyer Sequencing", "ask", "Choose where failure alerts go (Teams)", "Darren", "This week"],
    ["Development Playbook", "ask", "Agree the must-have field list", "Darren", "Next week"],
    ["Development Playbook", "ask", "Confirm RP Data and Cordell Connect access and cost", "Darren", "Next week"],
    ["Meta Lead Funnel", "ask", "Confirm landing-page forms feed Vault", "Thomas", "This week"],
    ["Buyer Sequencing", "shipped", "Conversation log now feeds the dashboard", null, null],
    ["Buyer Sequencing", "shipped", "Vault connection live against real listings", null, null],
    ["Platform", "shipped", "Data-status badges on every widget", null, null],
    ["Buyer Sequencing", "blocker", "ClickSend inbound rule not set", "Thomas", "6 days"],
    ["Buyer Sequencing", "blocker", "Contact category not named", "Darren", "4 days"],
    ["Buyer Sequencing", "blocker", "Alert destination undecided", "Darren", "3 days"],
    ["Buyer Sequencing", "milestone", "Conversation log connected", null, "done"],
    ["Buyer Sequencing", "milestone", "Outbound send released", null, "next"],
    ["Buyer Sequencing", "milestone", "Vault listings sync", null, "next"],
    ["Platform", "milestone", "Entra sign-in for company users", null, "next"],
    ["Development Playbook", "ask", "Name who runs the Monday playbook at PRD", "Darren", "Next week"],
    ["Development Playbook", "ask", "Agree the ownership hold-period rule", "Darren", "Next week"],
    ["Development Playbook", "shipped", "Pipeline board, table and weekly snapshot with zoning confirmation", null, null],
    ["Development Playbook", "blocker", "RP Data and Cordell access and cost not confirmed", "Darren with Cotality", "Open"],
    ["Development Playbook", "milestone", "Weekly feed from the NSW Planning Portal", null, "next"],
    ["Development Playbook", "milestone", "Owner and director trace recorded on each site", null, "next"],
    ["Development Playbook", "milestone", "Monday report run by a PRD team member", null, "next"],
  ];
  for (const [project, kind, text, owner, due] of items) {
    await q(`insert into progress_items (project, kind, text, owner, due) values ($1,$2,$3,$4,$5)`, [project, kind, text, owner, due]);
  }
}

console.log("seeded");
await client.end();
