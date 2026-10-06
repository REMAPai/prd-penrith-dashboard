import pg from "pg";

// Illustrative rows for the "Data under testing" view of the Development Pipeline. Every address, company, ABN and
// director here is invented; none of it is PRD or council data. Re-running replaces only is_sample rows.
const C = {
  Penrith: [-33.751, 150.694], "St Marys": [-33.765, 150.775], Kingswood: [-33.76, 150.72], Werrington: [-33.757, 150.745],
  "Cambridge Park": [-33.74, 150.71], "Emu Plains": [-33.746, 150.66], Jamisontown: [-33.77, 150.68], "Oxley Park": [-33.755, 150.79],
  Mulgoa: [-33.73, 150.67], Cranebrook: [-33.71, 150.72], Caddens: [-33.74, 150.76], "Glenmore Park": [-33.79, 150.67],
  Springwood: [-33.7, 150.56], Katoomba: [-33.713, 150.312],
};
const SV = "NSW Planning Portal Spatial Viewer";
const NF = "Not yet found";

// [address, suburb, lga, zoning, confirmed, lot, stage, pri, signal, daNo, daType, daStatus, applicant, abn, contact, ownershipSignal, holdYears, fsr, height, nextStep, notes, daysAgo]
const rows = [
  ["12 Sample Street", "St Marys", "Penrith", "R4 High Density", true, "1,450 m2", 4, "H", "DA approved nearby, 3 adjoining lots same owner", "SAMPLE/DA26/0101", "DA", "Approved", "Sample Build Co Pty Ltd", "00 000 000 001", "Phone and email found", "Multiple adjoining lots, same owner", 14, "1.5:1", "15 m", "Prepare offer range", "Assembly of 3 lots, strong multi-dwelling candidate.", 40],
  ["7 Example Road", "Kingswood", "Penrith", "R3 Medium Density", true, "1,260 m2", 3, "H", "Previously withdrawn listing", "SAMPLE/DA26/0102", "DA", "Lodged", "Example Homes Pty Ltd", "00 000 000 002", "Email found", "Previously withdrawn listing", 11, "0.7:1", "11 m", "Call owner, confirm interest", "Meets multi-dwelling lot size (1,200 m2 or more).", 33],
  ["31 Sample Avenue", "Oxley Park", "Penrith", "R3 Medium Density", true, "980 m2", 2, "M", "DA lodged, lot size below multi-dwelling threshold", "SAMPLE/DA26/0103", "DA", "Lodged", "Illustrative Developments Pty Ltd", "00 000 000 003", "Director named, no phone", "Hold period over threshold", 18, "0.7:1", "11 m", "Run iD4Me search", "Subdivision candidate only, below 1,200 m2.", 27],
  ["4 Sample Place", "Werrington", "Penrith", "R4 High Density", true, "2,100 m2", 5, "H", "Rezoned R4, owner approached", "SAMPLE/DA26/0104", "DA", "Pre-lodgement", "Sample Build Co Pty Ltd", "00 000 000 001", "Phone and email found", "Multiple adjoining lots, same owner", 22, "2.0:1", "15 m", "Negotiate terms", "Mirrors the worked Werrington example in the tracker.", 90],
  ["58 Example Street", "Penrith", "Penrith", "TBC", false, null, 0, "M", "Strata subdivision x 4 lots lodged", "SAMPLE/DA26/0105", "DA", "Lodged", "Applicant not yet confirmed", null, NF, null, null, null, null, "Confirm zoning on NSW Planning Portal", "Zoning unconfirmed, excluded from priority list.", 6],
  ["19 Sample Road", "Cambridge Park", "Penrith", "R2 Low Density", true, "720 m2", 1, "L", "DA activity only", "SAMPLE/DA26/0106", "DA", "Lodged", "Example Homes Pty Ltd", "00 000 000 002", NF, "None yet", null, "0.5:1", "9 m", "Check for second signal", "Zoning match alone does not qualify. Needs one more signal.", 12],
  ["2 Illustrative Court", "Mulgoa", "Penrith", "RU5 Village", true, "5,200 m2", 1, "H", "Refusal under review, motivated seller signal", "SAMPLE/DA26/0107", "DA", "Refused", "Sample Rural Holdings Pty Ltd", "00 000 000 004", "Director named, no phone", "Refusal under review or appeal", 9, "0.5:1", "9 m", "Trace director via ASIC", "Refused subdivision, review lodged.", 19],
  ["88 Example Avenue", "Jamisontown", "Penrith", "E3 Productivity Support", true, "3,400 m2", 2, "M", "Commercial owner, long hold", "SAMPLE/DA26/0108", "CDC", "Approved", "Illustrative Industrial Pty Ltd", "00 000 000 005", "Phone found", "Hold period over threshold", 21, "1.0:1", "12 m", "Check Cityscope for tenants", "Employment zone, commercial expansion target.", 45],
  ["15 Sample Lane", "Cranebrook", "Penrith", "R3 Medium Density", true, "1,320 m2", 6, "H", "Acquired, DA approved", "SAMPLE/DA26/0109", "DA", "Approved", "Sample Build Co Pty Ltd", "00 000 000 001", "Phone and email found", "Multiple adjoining lots, same owner", 16, "0.8:1", "11 m", "Hand to project marketing", "Ready to hand over to project marketing.", 160],
  ["3 Example Close", "Caddens", "Penrith", "R3 Medium Density", true, "1,210 m2", 7, "M", "In marketing", "SAMPLE/DA26/0110", "DA", "Approved", "Example Homes Pty Ltd", "00 000 000 002", "Phone found", "Previously withdrawn listing", 8, "0.8:1", "11 m", "Weekly campaign review", "8 townhouses released to market.", 210],
  ["26 Sample Drive", "Glenmore Park", "Penrith", "R2 Low Density", false, "TBC", 0, "L", "Dual occupancy DA lodged", "SAMPLE/DA26/0111", "DA", "Lodged", "Applicant not yet confirmed", null, NF, null, null, null, null, "Confirm zoning on NSW Planning Portal", "Rural-fringe style lot, check before pursuing.", 4],
  ["41 Illustrative Street", "Emu Plains", "Penrith", "R4 High Density", true, "1,800 m2", 3, "M", "Owner contact found, approach scheduled", "SAMPLE/DA26/0112", "DA", "Lodged", "Illustrative Developments Pty Ltd", "00 000 000 003", "Phone and email found", "Hold period over threshold", 15, "1.5:1", "15 m", "Approach on Monday", "Near station, apartment potential.", 21],
  ["9 Sample Crescent", "St Marys", "Penrith", "R3 Medium Density", false, "TBC", 0, "M", "CDC lodged, new this week", "SAMPLE/CDC26/0113", "CDC", "Lodged", "Applicant not yet confirmed", null, NF, null, null, null, null, "Confirm zoning on NSW Planning Portal", "New this week, not yet qualified.", 2],
  ["67 Example Parade", "Kingswood", "Penrith", "R3 Medium Density", true, "1,500 m2", 8, "M", "Units selling", "SAMPLE/DA26/0114", "DA", "Approved", "Sample Build Co Pty Ltd", "00 000 000 001", "Phone found", "Multiple adjoining lots, same owner", 12, "0.8:1", "11 m", "Track sales", "12 of 16 units sold.", 300],
  ["5 Illustrative Way", "Oxley Park", "Penrith", "R3 Medium Density", true, "1,240 m2", 9, "L", "Project settled", "SAMPLE/DA26/0115", "DA", "Approved", "Example Homes Pty Ltd", "00 000 000 002", "Phone found", "Previously withdrawn listing", 10, "0.8:1", "11 m", "Closed, write up lessons", "Settled example, shows the end of the pipeline.", 420],
  ["14 Sample Street", "Springwood", "Blue Mountains", "R2 Low Density", true, "840 m2", 1, "M", "Subdivision DA, Blue Mountains LEP to confirm", "SAMPLE/BM26/0201", "DA", "Lodged", "Illustrative Developments Pty Ltd", "00 000 000 003", NF, "None yet", null, "0.5:1", "8.5 m", "Confirm Blue Mountains LEP lot size", "Blue Mountains thresholds differ from Penrith.", 9],
  ["22 Example Road", "Katoomba", "Blue Mountains", "E1 Local Centre", false, "TBC", 0, "L", "Shop-top housing DA", "SAMPLE/BM26/0202", "DA", "Lodged", "Applicant not yet confirmed", null, NF, null, null, null, null, "Confirm zoning on NSW Planning Portal", "Employment zone codes to confirm for this council.", 5],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("begin");
try {
  await client.query("delete from pipeline_sites where is_sample = true");
  let i = 0;
  for (const r of rows) {
    const [address, suburb, lga, zoning, confirmed, lot, stage, pri, signal, daNo, daType, daStatus, applicant, abn, contact, own, hold, fsr, height, next, notes, daysAgo] = r;
    const [lat, lng] = C[suburb];
    i++;
    await client.query(
      `insert into pipeline_sites (branch_id, address, suburb, lga, zoning, zoning_confirmed, zoning_source, lot_size, stage, priority, signal, da_number, da_type, da_status,
         applicant, abn, contact_found, ownership_signal, hold_years, fsr, height_m, source, next_step, notes, lat, lng, is_sample, identified_on, stage_changed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'Data under testing',$22,$23,$24,$25,true,
         current_date - $26::int, now() - ($26::int / 3 || ' days')::interval)`,
      [lga === "Blue Mountains" ? "bm" : "pen", address, suburb, lga, zoning, confirmed, confirmed ? SV : null, lot, stage, pri, signal, daNo, daType, daStatus,
        applicant, abn, contact, own, hold, fsr, height, next, notes, lat + ((i * 7) % 11 - 5) * 0.0011, lng + ((i * 5) % 13 - 6) * 0.0011, daysAgo],
    );
  }
  await client.query("commit");
  console.log(`seeded ${rows.length} sample sites`);
} catch (e) {
  await client.query("rollback");
  throw e;
}
await client.end();
