import "server-only";
import { query } from "./db";
import { entraEnabled } from "./entra";
import type { Status } from "./roles";

export type Health = { name: string; status: Status; detail: string; owner: string; needs?: string };

async function ping(url: string, init: RequestInit = {}): Promise<number> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), next: { revalidate: 60 } });
  return res.status;
}

export async function checkSources(): Promise<Health[]> {
  const out: Health[] = [];
  const add = (h: Health) => out.push(h);

  try {
    await query("select 1");
    add({ name: "Postgres (app database)", status: "live", detail: "Connected", owner: "REMAP" });
  } catch {
    add({ name: "Postgres (app database)", status: "waiting", detail: "Cannot connect", owner: "REMAP", needs: "Check DATABASE_URL and the Dokploy firewall" });
  }

  const n8n = process.env.N8N_BASE_URL?.replace(/\/$/, "");
  if (n8n && process.env.N8N_API_KEY) {
    try {
      const s = await ping(`${n8n}/api/v1/workflows?limit=1`, { headers: { "X-N8N-API-KEY": process.env.N8N_API_KEY } });
      add({ name: "n8n (workflows and executions)", status: s === 200 ? "live" : "waiting", detail: s === 200 ? "API reachable" : `HTTP ${s}`, owner: "REMAP" });
    } catch {
      add({ name: "n8n (workflows and executions)", status: "waiting", detail: "Unreachable", owner: "REMAP" });
    }
  } else add({ name: "n8n (workflows and executions)", status: "waiting", detail: "Not configured", owner: "REMAP", needs: "N8N_BASE_URL and N8N_API_KEY" });

  if (process.env.CONVERSATIONS_WEBHOOK_KEY && process.env.CONVERSATIONS_WEBHOOK_EMAIL) add({ name: "Conversation log (Google Sheet via n8n)", status: "live", detail: "Configured", owner: "REMAP" });
  else add({ name: "Conversation log (Google Sheet via n8n)", status: "waiting", detail: "Not connected", owner: "Hamza", needs: "CONVERSATIONS_WEBHOOK_EMAIL and CONVERSATIONS_WEBHOOK_KEY (or a Sheets service account)" });

  if (process.env.VAULT_API_BASE_URL && process.env.VAULT_API_KEY && process.env.VAULT_API_TOKEN) {
    try {
      const s = await ping(`${process.env.VAULT_API_BASE_URL}/properties/sale?pagesize=1`, { headers: { "X-Api-Key": process.env.VAULT_API_KEY, Authorization: `Bearer ${process.env.VAULT_API_TOKEN}` } });
      add({ name: "MRI Vault (listings, contacts)", status: s === 200 ? "live" : "waiting", detail: s === 200 ? "Read access confirmed" : `HTTP ${s}`, owner: "REMAP / PRD", needs: s === 200 ? undefined : "Check the API key and token" });
    } catch {
      add({ name: "MRI Vault (listings, contacts)", status: "waiting", detail: "Unreachable", owner: "REMAP" });
    }
  } else add({ name: "MRI Vault (listings, contacts)", status: "waiting", detail: "Not configured", owner: "REMAP", needs: "VAULT_API_BASE_URL, key and token" });

  if (process.env.CLICKSEND_USERNAME && process.env.CLICKSEND_API_KEY) {
    try {
      const auth = Buffer.from(`${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`).toString("base64");
      const s = await ping("https://rest.clicksend.com/v3/account", { headers: { Authorization: `Basic ${auth}` } });
      add({ name: "ClickSend (SMS)", status: s === 200 ? "live" : "waiting", detail: s === 200 ? "Account reachable. Outbound sending is held." : `HTTP ${s}`, owner: "Thomas", needs: "Inbound reply rule pointed at our webhook" });
    } catch {
      add({ name: "ClickSend (SMS)", status: "waiting", detail: "Unreachable", owner: "Thomas" });
    }
  } else add({ name: "ClickSend (SMS)", status: "waiting", detail: "Not configured", owner: "Thomas" });

  add(entraEnabled()
    ? { name: "Microsoft Entra sign-in", status: "live", detail: "Enabled", owner: "REMAP", needs: "PRD tenant users need guest access or their own app registration" }
    : { name: "Microsoft Entra sign-in", status: "waiting", detail: "Turned off", owner: "Hamza", needs: "AUTH_ENTRA_ENABLED=true and redirect URI registered" });
  add({ name: "Meta (lead ads, messages)", status: "waiting", detail: "No credentials", owner: "Thomas", needs: "Business verification and leads_retrieval approval" });
  add({ name: "Google Sheets (projects stock, Meta leads)", status: "waiting", detail: "No read access", owner: "Thomas", needs: "Read-only share to a service account" });
  add({ name: "NSW Planning Portal DA feed", status: "planned", detail: "Free source, not wired yet", owner: "REMAP" });
  add({ name: "RP Data and Cordell Connect", status: "waiting", detail: "Access and cost not confirmed", owner: "Darren", needs: "Cotality account manager" });
  add({ name: "Jira (progress items)", status: "planned", detail: "Progress is edited in the app for now", owner: "REMAP" });
  return out;
}
