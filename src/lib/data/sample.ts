import type { AlertRow, Conversation, FinanceMonth, Listing, MetaWeek, Project } from "./types";

// Deterministic sample data. Everything here is invented for layout. Never present it as PRD figures.
function rng(seed: string) {
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let a = h;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUBURBS = ["Penrith", "St Marys", "Kingswood", "Werrington", "Cambridge Park", "Emu Plains", "Jamisontown", "Oxley Park", "Glenmore Park", "Cranebrook"];
const STREETS = ["Banksia", "Wattle", "Jacaranda", "Redgum", "Coral", "Eucalypt", "River", "Station", "Park", "Hill"];
const SFX = ["St", "Rd", "Ave", "Cres"];
const AGENTS = ["Sample Agent A", "Sample Agent B", "Sample Agent C"];

export function sampleConversations(seed: string, n = 40): Conversation[] {
  const r = rng(seed + "c");
  const pk = <T,>(x: T[]) => x[Math.floor(r() * x.length)];
  const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const daysAgo = Math.floor(Math.pow(r(), 1.5) * 14);
    const when = new Date(now - daysAgo * 86400000 - ri(0, 12) * 3600000);
    const temp = r() < 0.25 ? "Hot" : r() < 0.55 ? "Warm" : "New";
    const ready = temp === "Hot" || (temp === "Warm" && r() < 0.5);
    const prop = `${ri(3, 180)} ${pk(STREETS)} ${pk(SFX)}, ${pk(SUBURBS).toUpperCase()}`;
    const turns = [{ at: when.toISOString(), buyer: "Is this still available?", assistant: "Yes, it is. Open home this Saturday 10:30 am. Would that suit?" }];
    if (temp !== "New") turns.push({ at: new Date(when.getTime() + 8 * 60000).toISOString(), buyer: "Saturday works. We are pre-approved.", assistant: "Great, I have noted that for the agent." });
    return {
      conversationId: `sample-${seed}-${i}`,
      buyer: `Sample Buyer ${String(i + 1).padStart(2, "0")}`,
      phone: "0400 000 000",
      email: "sample@example.test",
      property: prop,
      source: pk(["REA", "Domain", "Website"]),
      agent: ready ? pk(AGENTS) : "",
      temperature: temp,
      buyerType: pk(["First home buyer", "Investor", "Upgrader"]),
      financeStatus: pk(["Pre-approved", "Speaking to broker", "Cash buyer", ""]),
      needsToSellFirst: pk(["Yes", "No", ""]),
      timeframe: pk(["0-3 months", "3-6 months", ""]),
      inspection: temp === "New" ? "not_discussed" : pk(["offered_not_answered", "asked_about_it", "booked"]),
      wantsContract: r() < 0.1,
      consent: ready ? "Yes" : "Not yet asked",
      readyForAgent: ready,
      whyReady: ready ? "Pre-approved and inspection booked" : "",
      afterHours: r() < 0.35,
      startedAt: when.toISOString(),
      lastAt: new Date(when.getTime() + 20 * 60000).toISOString(),
      date: when.toISOString().slice(0, 10),
      turns,
    };
  });
}

export function sampleListings(seed: string, n = 12): Listing[] {
  const r = rng(seed + "l");
  const pk = <T,>(x: T[]) => x[Math.floor(r() * x.length)];
  const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  return Array.from({ length: n }, (_, i) => ({
    id: `sample-l${i}`,
    address: `${ri(3, 180)} ${pk(STREETS)} ${pk(SFX)}`,
    suburb: pk(SUBURBS),
    type: pk(["House", "Townhouse", "Unit", "Land"]),
    bed: ri(1, 5),
    bath: ri(1, 3),
    cars: ri(0, 2),
    price: pk(["$650k to $720k", "$780k to $850k", "$900k to $980k", "$1.1m to $1.2m"]),
    lat: null,
    lng: null,
    modified: new Date().toISOString(),
    enquiries30: ri(4, 40),
    hot: ri(0, 6),
  }));
}

export function sampleProjects(seed: string): Project[] {
  const r = rng(seed + "p");
  const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  return ["Test Gardens", "Test Court", "Test Heights"].map((name) => {
    const total = ri(8, 20);
    const sold = ri(0, 4);
    return { name, suburb: SUBURBS[ri(0, SUBURBS.length - 1)], total, available: total - sold, sold, valueM: +(ri(30, 90) / 10).toFixed(1), band: "$600k to $900k", enquiries: ri(4, 30) };
  });
}

export function sampleMeta(seed: string): MetaWeek[] {
  const r = rng(seed + "m");
  const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  return Array.from({ length: 8 }, (_, i) => ({ week: `Wk ${33 + i}`, leads: ri(28, 72), hoursToFirst: ri(8, 90), inVault: ri(10, 40), dropPct: ri(5, 35) }));
}

export function sampleFinance(seed: string): FinanceMonth[] {
  const r = rng(seed + "f");
  const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  return ["May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((month) => ({ month, revenue: ri(180, 420), expenses: ri(120, 260) }));
}

export function sampleAlerts(): AlertRow[] {
  return [
    { key: "s1", severity: "high", source: "n8n", message: "Workflow failed: buyer reply step", age: "2 h" },
    { key: "s2", severity: "med", source: "ClickSend", message: "Delivery failures above 3% in the last hour", age: "5 h" },
    { key: "s3", severity: "low", source: "Quality", message: "Duplicate reply detected in 2 conversations", age: "1 d" },
    { key: "s4", severity: "med", source: "Vault", message: "Daily request quota at 80%", age: "1 d" },
  ];
}
