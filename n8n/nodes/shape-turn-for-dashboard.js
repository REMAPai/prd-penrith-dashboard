// "Shape Turn for Dashboard" in the buyer enquiry workflow (mode: run once for each item).
// Maps the Activity Log row to the dashboard's turn format (POST /api/ingest/turn, turnSchema in src/lib/data/ingest.ts).
// Only real conversations pass through here: Buyer Test Chat never reaches this node.
const j = $json;
const iso = (v) => { const t = new Date(v); return isNaN(t) ? null : t.toISOString(); };
const nowIso = new Date().toISOString();
const when = iso(j.timestamp) || nowIso;
const ready = j.readyForAgent === true || String(j.readyForAgent).toLowerCase() === 'true';
const rec = j.hadPropertyRecord;
const hadPropertyRecord = (rec === true || String(rec).toLowerCase() === 'true') ? 'yes' : ((rec === false || String(rec).toLowerCase() === 'false') ? 'no' : '');
const turnNo = Math.max(1, Math.min(500, Number(j.turn) || 1));

// First turn: use the time the buyer actually enquired in Vault, so the day tab and the first-reply gap are real.
// Falls back to now if the field is missing, not a full date-time, or in the future.
let buyerAt = when;
if (turnNo === 1) {
  try {
    const raw = String($('Save Conversation State').item.json.enquiryDate || '');
    const e = raw.includes('T') ? iso(raw) : null;
    if (e && new Date(e) <= new Date(when)) buyerAt = e;
  } catch (err) { /* keep now */ }
}

return {
  json: {
    conversationId: String(j.conversationId || ''),
    enquiryId: String(j.enquiryId || ''),
    buyer: String(j.buyer || ''),
    phone: String(j.phone || ''),
    email: String(j.email || ''),
    property: String(j.property || ''),
    source: String(j.source || ''),
    agent: String(j.agent || ''),
    agentEmail: String(j.agentEmail || ''),
    hadPropertyRecord,
    temperature: ['Hot', 'Warm', 'New'].includes(j.temperature) ? j.temperature : 'New',
    buyerType: String(j.buyerType || ''),
    financeStatus: String(j.financeStatus || ''),
    needsToSellFirst: String(j.needsToSellFirst || ''),
    timeframe: String(j.timeframe || ''),
    inspection: String(j.inspection || 'not_discussed'),
    wantsContract: j.wantsContract === true || String(j.wantsContract).toLowerCase() === 'true',
    consent: String(j.consent || ''),
    readyForAgent: ready,
    whyReady: String(j.whyReady || ''),
    handoffStatus: ready ? 'pending' : 'none',
    slaDueAt: null,
    afterHours: j.afterHours === true || String(j.afterHours).toLowerCase() === 'true',
    blocked: String(j.blocked || ''),
    turn: turnNo,
    buyerMessage: String(j.buyerMessage || ''),
    assistantReply: String(j.assistantReply || ''),
    buyerAt,
    replyAt: when
  }
};
