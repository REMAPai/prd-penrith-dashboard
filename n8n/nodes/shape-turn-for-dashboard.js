// Maps the Activity Log row to the dashboard ingest schema (src/lib/data/ingest.ts).
const j = $json;
const iso = (v) => { const t = new Date(v); return isNaN(t) ? null : t.toISOString(); };
const nowIso = new Date().toISOString();
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
    temperature: ['Hot', 'Warm', 'New'].includes(j.temperature) ? j.temperature : 'New',
    buyerType: String(j.buyerType || ''),
    financeStatus: String(j.financeStatus || ''),
    needsToSellFirst: String(j.needsToSellFirst || ''),
    timeframe: String(j.timeframe || ''),
    inspection: String(j.inspection || 'not_discussed'),
    wantsContract: Boolean(j.wantsContract),
    consent: String(j.consent || ''),
    readyForAgent: Boolean(j.readyForAgent),
    whyReady: String(j.whyReady || ''),
    handoffStatus: ['none', 'pending', 'done'].includes(j.handoffStatus) ? j.handoffStatus : 'none',
    slaDueAt: iso(j.slaDueAt),
    afterHours: j.afterHours === true,
    blocked: String(j.blocked || ''),
    turn: Number(j.turn) || 1,
    buyerMessage: String(j.buyerMessage || ''),
    assistantReply: String(j.assistantReply || ''),
    buyerAt: iso(j.buyerAt) || nowIso,
    replyAt: iso(j.replyAt) || nowIso
  }
};
