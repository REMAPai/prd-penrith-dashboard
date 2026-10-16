// Runs after "Opt-Out Memory Row" in the buyer enquiry workflow (mode: run once for each item).
// Maps a STOP reply to the body of POST /api/ingest/optout (optoutSchema in src/lib/data/ingest.ts).
// It sends only the conversation id, the time and the message, so nothing the dashboard already knows about the buyer is overwritten.
// A second HTTP Request node, "Store Opt-Out (dashboard DB)", posts the result to https://prd.remap.ai/api/ingest/optout
// with the same "PRD ingest key" header credential as "Store Turn (dashboard DB)", and continues on error.
const j = $json;
let message = 'STOP';
try { message = String($('Opt-Out?').item.json.message || 'STOP').slice(0, 200); } catch (e) { /* keep the default */ }
return {
  json: {
    conversationId: String(j.conversationId || ''),
    message,
    at: new Date().toISOString()
  }
};
