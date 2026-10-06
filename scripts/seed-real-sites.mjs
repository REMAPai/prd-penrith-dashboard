import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

// Real source observations supplied by Suffyan (REA land listings and Penrith planning activity, 7 Oct 2026).
// Additive: rows that already exist are skipped and nothing is deleted. Pass --dry-run to print the plan only.
const data = JSON.parse(readFileSync(join(process.cwd(), "scripts", "data", "suffyan-sourcing-2026-10-07.json"), "utf8"));
const dry = process.argv.includes("--dry-run");

// Approximate suburb centres (lat, lng); parcel-level geocoding comes later.
const C = {
  Penrith: [-33.751, 150.694], "South Penrith": [-33.77, 150.7], "St Marys": [-33.765, 150.775], Kingswood: [-33.76, 150.72], Werrington: [-33.757, 150.745],
  "Werrington County": [-33.75, 150.74], "Emu Plains": [-33.746, 150.66], "Emu Heights": [-33.73, 150.64], Jamisontown: [-33.77, 150.68],
  "Oxley Park": [-33.755, 150.79], Mulgoa: [-33.73, 150.67], Cranebrook: [-33.71, 150.72], Caddens: [-33.74, 150.76],
  "Claremont Meadows": [-33.76, 150.755], "Jordan Springs": [-33.72, 150.78], "Orchard Hills": [-33.783, 150.733], "Kemps Creek": [-33.867, 150.767],
  "Erskine Park": [-33.817, 150.783], "St Clair": [-33.8, 150.767], "Mount Vernon": [-33.85, 150.83],
};
const jitter = (i) => [((i * 7) % 11 - 5) * 0.0009, ((i * 5) % 13 - 6) * 0.0009];
const point = (suburb, i) => (C[suburb] ? [C[suburb][0] + jitter(i)[0], C[suburb][1] + jitter(i)[1]] : [null, null]);

const captured = new Date(`${data.capturedOn}T00:00:00Z`);
const ago = (label) => {
  const n = /^(\d+) days? ago$/.exec(label);
  if (n) return Number(n[1]);
  if (/about 1 month/.test(label)) return 30;
  if (/about 2 months/.test(label)) return 60;
  throw new Error(`Unrecognised recency: ${label}`);
};
const dateAgo = (days) => new Date(captured.getTime() - days * 86400000).toISOString().slice(0, 10);

// First-pass priority from the description only. It is a sorting aid, not a qualification: zoning is still unconfirmed.
const priority = (t) => {
  const s = t.toLowerCase();
  if (/multi[- ]dwelling|townhouse|shop top|attached dwellings|developable lots|residential & retail/.test(s)) return "H";
  if (/subdivision|warehouse|distribution|industrial|commercial development|remediation|mixed use/.test(s)) return "M";
  return "L";
};

const planning = data.planning.map((p, i) => {
  const days = ago(p.recency);
  const [lat, lng] = point(p.suburb, i);
  return {
    address: p.address, suburb: p.suburb, priority: priority(`${p.activityArea} ${p.description}`), signal: p.activityArea,
    daNumber: /\bDA\d{2}\/\d{3,4}\b/.exec(p.description)?.[0] ?? null, notes: p.description,
    recency: `${p.recency} (as at 7 Oct 2026)`, identified: dateAgo(days), lat, lng,
  };
});
const listings = data.listings.map((l) => {
  return {
    address: l.address, suburb: l.suburb, signal: "Open-market land listing", lot: l.landSizeM2 == null ? null : `${l.landSizeM2.toLocaleString("en-AU")} m2`,
    price: l.priceGuide, notes: `${l.notes} (${l.source}), captured 7 Oct 2026`, 
  };
});

if (dry) {
  const by = (rows, k) => rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
  console.log("planning", planning.length, "priority", by(planning, "priority"), "with DA number", planning.filter((p) => p.daNumber).length, "without map point", planning.filter((p) => p.lat == null).length);
  console.log("listings", listings.length, "without land size", listings.filter((l) => !l.lot).length, "without price", listings.filter((l) => !l.price).length);
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("begin");
try {
  let added = 0;
  for (const p of planning) {
    const r = await client.query(
      `insert into pipeline_sites (branch_id, address, suburb, lga, zoning, zoning_confirmed, stage, priority, signal, da_number, source, next_step, notes, recency_label, site_kind, lat, lng, is_sample, identified_on, stage_changed_at)
       select 'pen', $1, $2, 'Penrith', 'TBC', false, 0, $3, $4, $5, 'Planning Alerts (Penrith City Council)', 'Confirm zoning on NSW Planning Portal Spatial Viewer', $6, $7, 'da', $8, $9, false, $10, $10
       where not exists (select 1 from pipeline_sites where branch_id = 'pen' and site_kind = 'da' and address = $1 and coalesce(notes, '') = $6)`,
      [p.address, p.suburb, p.priority, p.signal, p.daNumber, p.notes, p.recency, p.lat, p.lng, p.identified],
    );
    added += r.rowCount;
  }
  for (const l of listings) {
    const r = await client.query(
      `insert into pipeline_sites (branch_id, address, suburb, lga, zoning, zoning_confirmed, stage, priority, signal, lot_size, price_guide, source, next_step, notes, recency_label, site_kind, is_sample, identified_on)
       select 'pen', $1, $2, 'Penrith', 'TBC', false, 0, 'M', $3, $4, $5, 'REA', 'Check zoning, lot and development potential', $6, 'Captured 7 Oct 2026', 'listing', false, '2026-10-07'
       where not exists (select 1 from pipeline_sites where branch_id = 'pen' and site_kind = 'listing' and address = $1 and coalesce(lot_size, '') = coalesce($4, '') and coalesce(price_guide, '') = coalesce($5, ''))`,
      [l.address, l.suburb, l.signal, l.lot, l.price, l.notes],
    );
    added += r.rowCount;
  }
  await client.query("commit");
  console.log(`added ${added} of ${planning.length + listings.length} rows`);
} catch (e) {
  await client.query("rollback");
  throw e;
}
await client.end();
