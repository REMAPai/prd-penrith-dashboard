// Outbound is held until PRD approves. Flip OUTBOUND_LIVE only on written approval
// (and set OUTBOUND_SENDING_LIVE=true in the dashboard so it shows the truth).
// While held, only numbers on ALLOWLIST can receive a real SMS, e.g. Thomas's test phone.
const OUTBOUND_LIVE = false;
const ALLOWLIST = []; // E.164, e.g. '+614XXXXXXXX'

const d = $json;
const to = String(d.contactPhone || '').replace(/\s+/g, '');
const allowed = OUTBOUND_LIVE || ALLOWLIST.includes(to);
if (!allowed || d.optOutRequested) return [];
return { json: d };
