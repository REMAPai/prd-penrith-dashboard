import { describe, expect, it, vi } from "vitest";
import { query } from "@tests/helpers/db";

vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);

import { checkSources } from "@/lib/health";

const get = async (name: string) => (await checkSources()).find((h) => h.name.startsWith(name))!;
const fetchStatus = (status: number) => vi.stubGlobal("fetch", vi.fn(async () => ({ status })));
const fetchThrows = () => vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));

describe("checkSources", () => {
  it("returns all eleven sources in a stable order", async () => {
    expect((await checkSources()).map((h) => h.name)).toEqual([
      "Postgres (app database)",
      "n8n (workflows and executions)",
      "Conversation log (Google Sheet via n8n)",
      "MRI Vault (listings, contacts)",
      "ClickSend (SMS)",
      "Microsoft Entra sign-in",
      "Meta (lead ads, messages)",
      "Google Sheets (projects stock, Meta leads)",
      "NSW Planning Portal DA feed",
      "RP Data and Cordell Connect",
      "Jira (progress items)",
    ]);
  });

  it("never calls out when nothing is configured", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const all = await checkSources();
    expect(spy).not.toHaveBeenCalled();
    expect(all.filter((h) => h.status === "live")).toHaveLength(1);
  });

  describe("postgres", () => {
    it("is live when select 1 works", async () => {
      expect(await get("Postgres")).toMatchObject({ status: "live", detail: "Connected" });
      expect(query).toHaveBeenCalledWith("select 1");
    });
    it("is waiting when the connection fails", async () => {
      query.mockRejectedValue(new Error("down"));
      expect(await get("Postgres")).toMatchObject({ status: "waiting", detail: "Cannot connect" });
    });
  });

  describe("n8n", () => {
    const cfg = () => {
      vi.stubEnv("N8N_BASE_URL", "https://n8n.test/");
      vi.stubEnv("N8N_API_KEY", "k");
    };
    it("is waiting when not configured", async () => {
      expect(await get("n8n")).toMatchObject({ status: "waiting", detail: "Not configured", needs: "N8N_BASE_URL and N8N_API_KEY" });
    });
    it("is live on 200 and sends the API key header to the trimmed base URL", async () => {
      cfg();
      fetchStatus(200);
      expect(await get("n8n")).toMatchObject({ status: "live", detail: "API reachable" });
      const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
      expect(url).toBe("https://n8n.test/api/v1/workflows?limit=1");
      expect(init.headers["X-N8N-API-KEY"]).toBe("k");
    });
    it("reports the HTTP status on failure and unreachable on error", async () => {
      cfg();
      fetchStatus(401);
      expect(await get("n8n")).toMatchObject({ status: "waiting", detail: "HTTP 401" });
      fetchThrows();
      expect(await get("n8n")).toMatchObject({ status: "waiting", detail: "Unreachable" });
    });
  });

  describe("conversation log", () => {
    it("is waiting until both variables are set, then live without any network call", async () => {
      expect(await get("Conversation log")).toMatchObject({ status: "waiting", owner: "Hamza" });
      vi.stubEnv("CONVERSATIONS_WEBHOOK_KEY", "k");
      expect((await get("Conversation log")).status).toBe("waiting");
      vi.stubEnv("CONVERSATIONS_WEBHOOK_EMAIL", "e@x.test");
      expect(await get("Conversation log")).toMatchObject({ status: "live", detail: "Configured" });
    });
  });

  describe("vault", () => {
    const cfg = () => {
      vi.stubEnv("VAULT_API_BASE_URL", "https://vault.test/v1");
      vi.stubEnv("VAULT_API_KEY", "key");
      vi.stubEnv("VAULT_API_TOKEN", "tok");
    };
    it("is waiting when not configured", async () => {
      expect(await get("MRI Vault")).toMatchObject({ status: "waiting", detail: "Not configured" });
    });
    it("is live on 200 and sends both credentials", async () => {
      cfg();
      fetchStatus(200);
      expect(await get("MRI Vault")).toMatchObject({ status: "live", detail: "Read access confirmed", needs: undefined });
      const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
      expect(url).toBe("https://vault.test/v1/properties/sale?pagesize=1");
      expect(init.headers).toEqual({ "X-Api-Key": "key", Authorization: "Bearer tok" });
    });
    it("is waiting with a hint on 403 and when unreachable", async () => {
      cfg();
      fetchStatus(403);
      expect(await get("MRI Vault")).toMatchObject({ status: "waiting", detail: "HTTP 403", needs: "Check the API key and token" });
      fetchThrows();
      expect(await get("MRI Vault")).toMatchObject({ status: "waiting", detail: "Unreachable" });
    });
  });

  describe("clicksend", () => {
    const cfg = () => {
      vi.stubEnv("CLICKSEND_USERNAME", "u");
      vi.stubEnv("CLICKSEND_API_KEY", "k");
    };
    it("is waiting when not configured", async () => {
      expect(await get("ClickSend")).toMatchObject({ status: "waiting", detail: "Not configured" });
    });
    it("is live on 200 with basic auth and states outbound is held", async () => {
      cfg();
      fetchStatus(200);
      const h = await get("ClickSend");
      expect(h).toMatchObject({ status: "live" });
      expect(h.detail).toContain("Outbound sending is held");
      const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
      expect(url).toBe("https://rest.clicksend.com/v3/account");
      expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("u:k").toString("base64")}`);
    });
    it("handles a non-200 and a network failure", async () => {
      cfg();
      fetchStatus(500);
      expect(await get("ClickSend")).toMatchObject({ status: "waiting", detail: "HTTP 500" });
      fetchThrows();
      expect(await get("ClickSend")).toMatchObject({ status: "waiting", detail: "Unreachable" });
    });
  });

  describe("entra and static sources", () => {
    it("reflects the Entra configuration", async () => {
      expect(await get("Microsoft Entra")).toMatchObject({ status: "waiting", detail: "Turned off" });
      vi.stubEnv("AUTH_ENTRA_ENABLED", "true");
      vi.stubEnv("AUTH_ENTRA_CLIENT_ID", "c");
      vi.stubEnv("AUTH_ENTRA_CLIENT_SECRET", "s");
      vi.stubEnv("AUTH_ENTRA_TENANT_ID", "t");
      expect(await get("Microsoft Entra")).toMatchObject({ status: "live", detail: "Enabled" });
    });
    it("keeps unbuilt integrations honest", async () => {
      expect((await get("Meta")).status).toBe("waiting");
      expect((await get("Google Sheets")).status).toBe("waiting");
      expect((await get("NSW Planning")).status).toBe("planned");
      expect((await get("RP Data")).status).toBe("waiting");
      expect((await get("Jira")).status).toBe("planned");
    });
  });
});
