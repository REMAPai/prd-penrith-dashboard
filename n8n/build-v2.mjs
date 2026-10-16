// Builds n8n/prd-buyer-enquiry-assistant-v2.json from the 2 Oct export of
// "PRD Penrith - Buyer Enquiry Assistant (LIVE)" (id rl7I6eSBH6ibF0di).
// Run: node n8n/build-v2.mjs   (no network, no secrets)
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const w = JSON.parse(fs.readFileSync(path.join(here, "original/rl7I6eSBH6ibF0di.json"), "utf8"));
const code = (f) => fs.readFileSync(path.join(here, "nodes", f), "utf8");
const node = (name) => {
  const n = w.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`node not found: ${name}`);
  return n;
};
const patch = (name, pairs) => {
  const n = node(name);
  const key = n.parameters.jsCode !== undefined ? "jsCode" : "bodyContent";
  let s = n.parameters[key];
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`${name}: snippet not found: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  n.parameters[key] = s;
};
const uid = () => crypto.randomUUID();

// ---- Normalise: postcode-only messages, next opening time, handoff routing ----
patch("Normalise Enquiry", [
  ["const out = [];", `// Next time the office is staffed, so the assistant never promises "tomorrow morning" on a Friday night.
function nextOpening(t) {
  const open = (d) => d.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
  let d = t;
  if (!(t.weekday <= 5 && hour < BUSINESS_START)) {
    d = t.plus({ days: 1 });
    while (d.weekday > 5) d = d.plus({ days: 1 });
  }
  d = open(d);
  const sameDay = d.hasSame(t, 'day');
  const nextDay = d.hasSame(t.plus({ days: 1 }), 'day');
  const label = sameDay ? 'this morning' : nextDay ? 'tomorrow morning' : d.toFormat('cccc') + ' morning';
  return { iso: d.toUTC().toISO(), label };
}
const nextOpen = afterHours ? nextOpening(t) : null;
const DEFAULT_HANDOFF = AGENTS['thomas latty'];
// While true, handoff emails go to the REMAP tester, not real PRD agents.
const TEST_MODE = true;
const TEST_NOTIFY = 'suffyan@remap.ai';

const out = [];`],
  ["const typed = String(src.enquiryMessage || '').trim();",
    `// REA sometimes puts the postcode field into the message ("$2148 or a postcode?").
  const rawTyped = String(src.enquiryMessage || '').trim();
  const postcodeOnly = /^(postcode\\W*)?\\$?\\d{4}\\W*(or\\W+(a\\W+)?postcode\\W*)?$/i.test(rawTyped);
  const typed = postcodeOnly ? '' : rawTyped;`],
  ["agentEmail: agent?.email ?? null,", `agentEmail: agent?.email ?? null,
      agentAssigned: Boolean(agent),
      handoffAgentEmail: agent?.email ?? DEFAULT_HANDOFF.email,
      notifyEmail: TEST_MODE ? TEST_NOTIFY : (agent?.email ?? DEFAULT_HANDOFF.email),
      nextOpenLabel: nextOpen?.label ?? null,
      nextOpenIso: nextOpen?.iso ?? null,`],
]);

// ---- Fact sheet: upcoming open homes with a 48 hour window ----
patch("Build Property Fact Sheet", [
  ["return { json: { ...enquiry, knowledgeBase, propertyFetchFailed: fetchFailed } };", `const rawOh = sale.openHomes ?? sale.inspectionTimes ?? [];
const nowMs = Date.now();
const slots = (Array.isArray(rawOh) ? rawOh : []).map(o => {
  if (!o || typeof o === 'string') return null;
  const start = o.startTime ?? o.start ?? o.dateTime ?? null;
  if (!start) return null;
  const s = DateTime.fromISO(String(start)).setZone('Australia/Sydney');
  if (!s.isValid) return null;
  const endRaw = o.endTime ?? o.end ?? null;
  const e = endRaw ? DateTime.fromISO(String(endRaw)).setZone('Australia/Sydney') : null;
  return { label: e && e.isValid ? \`\${s.toFormat('cccc d LLLL, h:mma')} - \${e.toFormat('h:mma')}\` : s.toFormat('cccc d LLLL, h:mma'), startMs: s.toMillis() };
}).filter(x => x && x.startMs > nowMs).sort((a, b) => a.startMs - b.startMs).slice(0, 6);
knowledgeBase.openHomeSlots = slots;
knowledgeBase.openHomesSoon = slots.filter(x => x.startMs - nowMs <= 48 * 3600 * 1000).map(x => x.label);
if (slots.length) knowledgeBase.openHomes = slots.slice(0, 3).map(x => x.label);

return { json: { ...enquiry, knowledgeBase, propertyFetchFailed: fetchFailed } };`],
]);

// ---- Prompt: receptionist persona, order of conversation, honest timing ----
node("Build Conversation Prompt").parameters.jsCode = code("build-conversation-prompt.js");

// ---- Scoring: carry consent forward, inspection interest hands over, SLA ----
patch("Score Qualification", [
  ["// REA tells us some of this without asking.", `if (prior.consentAsked === true) f.consentAsked = true;
if (f.consentOutcome === 'not_answered' && prior.consentOutcome && prior.consentOutcome !== 'not_answered') f.consentOutcome = prior.consentOutcome;

// REA tells us some of this without asking.`],
  ["  || f.wantsContract\n  || isHot;", "  || f.wantsContract\n  || f.inspectionInterest === 'asked_about_it'\n  || isHot;"],
  ["const whyReady = [", `// Promise a human response time we can actually be held to.
let slaDueAtIso = null;
if (readyForAgent) {
  const base = prev.afterHours && prev.nextOpenIso ? DateTime.fromISO(prev.nextOpenIso) : DateTime.now();
  slaDueAtIso = base.plus({ hours: 2 }).toUTC().toISO();
}

const whyReady = [`],
  ["inspectionBooked ? 'Inspection to confirm' : null,", "inspectionBooked ? 'Inspection to confirm' : null,\n  f.inspectionInterest === 'asked_about_it' ? 'Wants to inspect' : null,"],
  ["    readyForAgent,\n    whyReady: whyReady || 'Not yet',", "    readyForAgent,\n    handoffStatus: readyForAgent ? 'pending' : 'none',\n    slaDueAtIso,\n    whyReady: whyReady || 'Not yet',"],
]);

// ---- Activity log: extra fields for the dashboard ----
patch("Activity Log", [
  ["agentEmail: d.agentEmail ?? ''", `agentEmail: d.agentEmail ?? '',
    handoffStatus: d.handoffStatus ?? 'none',
    slaDueAt: d.slaDueAtIso ?? null,
    buyerAt: d.receivedAt ?? new Date().toISOString(),
    replyAt: new Date().toISOString()`],
]);

// ---- Handoff email: route per agent (test recipient while TEST_MODE) and state the deadline ----
const notify = node("Notify Listing Agent");
notify.parameters.toRecipients = "={{ $('Save Conversation State').item.json.notifyEmail }}";
patch("Notify Listing Agent", [
  ["Received: ${d.localTime}", "Received: ${d.localTime}\\nReply to the buyer by: ${d.slaDueAtIso ? new Date(d.slaDueAtIso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'as soon as you can'}"],
]);

// ---- New nodes ----
const claim = {
  id: uid(), name: "Claim Turn (dashboard DB)", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [-2800, -220],
  parameters: {
    method: "POST", url: "https://prd.remap.ai/api/ingest/claim",
    authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth",
    sendBody: true, specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ conversationId: $json.conversationId, message: $json.message }) }}",
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 8000 },
  },
  credentials: { httpHeaderAuth: { id: "SET_ME", name: "PRD ingest key" } },
};
const evalClaim = { id: uid(), name: "Evaluate Claim", type: "n8n-nodes-base.code", typeVersion: 2, position: [-2600, -220], parameters: { jsCode: code("evaluate-claim.js") } };
const claimed = {
  id: uid(), name: "Claimed?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [-2400, -220],
  parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: uid(), leftValue: "={{ $json.claimed }}", rightValue: true, operator: { type: "boolean", operation: "true" } }], combinator: "and" }, options: {} },
};
const gate = { id: uid(), name: "Outbound Gate", type: "n8n-nodes-base.code", typeVersion: 2, position: [776, 0], parameters: { jsCode: code("outbound-gate.js") } };
const shape = { id: uid(), name: "Shape Turn for Dashboard", type: "n8n-nodes-base.code", typeVersion: 2, position: [150, 1100], parameters: { jsCode: code("shape-turn-for-dashboard.js") } };
const store = {
  id: uid(), name: "Store Turn (dashboard DB)", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [400, 1100],
  parameters: {
    method: "POST", url: "https://prd.remap.ai/api/ingest/turn",
    authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth",
    sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify($json) }}",
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 },
  },
  credentials: { httpHeaderAuth: { id: "SET_ME", name: "PRD ingest key" } },
};
const failMail = {
  id: uid(), name: "Email - AI Step Failed", type: "n8n-nodes-base.microsoftOutlook", typeVersion: notify.typeVersion, position: [-1280, 384],
  parameters: {
    toRecipients: "suffyan@remap.ai",
    subject: "=ALERT: AI step failed for {{ $json.who }} ({{ $json.conversationId }})",
    bodyContent: "={{ 'No reply was sent. Manual follow-up needed.\\n\\nBuyer: ' + $json.who + '\\nPhone: ' + $json.phone + '\\nEmail: ' + $json.email + '\\nConversation: ' + $json.conversationId + '\\nAt: ' + $json.at }}",
    additionalFields: {},
  },
  credentials: notify.credentials,
};
w.nodes.push(claim, evalClaim, claimed, gate, shape, store, failMail);

// ---- Wiring ----
const c = w.connections;
const to = (name) => [{ node: name, type: "main", index: 0 }];
c["Safe to Proceed?"].main[0] = to("Claim Turn (dashboard DB)");
c["Claim Turn (dashboard DB)"] = { main: [to("Evaluate Claim")] };
c["Evaluate Claim"] = { main: [to("Claimed?")] };
c["Claimed?"] = { main: [to("Fetch Property"), to("Log & Stop")] };
c["Save Conversation State"].main[0] = c["Save Conversation State"].main[0].map((x) => (x.node === "Send SMS via ClickSend" ? { node: "Outbound Gate", type: "main", index: 0 } : x));
c["Outbound Gate"] = { main: [to("Send SMS via ClickSend")] };
c["Activity Log"].main[0].push({ node: "Shape Turn for Dashboard", type: "main", index: 0 });
c["Shape Turn for Dashboard"] = { main: [to("Store Turn (dashboard DB)")] };
c["Alert - AI Step Failed"] = { main: [to("Email - AI Step Failed")] };

// ---- Make it a safe, separate copy ----
node("Buyer SMS Reply").parameters.path = "sms-reply-v2";
for (const n of w.nodes) if (n.webhookId) n.webhookId = uid();
// The first live test must be hand-checked in the chat trigger; nothing is sent while the gate is shut.

const out = {
  name: "PRD Penrith - Buyer Enquiry Assistant v2 (copy, INACTIVE)",
  nodes: w.nodes,
  connections: w.connections,
  settings: { executionOrder: "v1" },
};
fs.writeFileSync(path.join(here, "prd-buyer-enquiry-assistant-v2.json"), JSON.stringify(out, null, 2));
console.log(`wrote v2: ${out.nodes.length} nodes (original ${JSON.parse(fs.readFileSync(path.join(here, "original/rl7I6eSBH6ibF0di.json"), "utf8")).nodes.length})`);
