import { describe, expect, it, vi } from "vitest";
import { convo } from "@tests/helpers/conversation";
import { getListings } from "@/lib/data/vault";

const cfg = () => {
  vi.stubEnv("VAULT_API_BASE_URL", "https://vault.test/api");
  vi.stubEnv("VAULT_API_KEY", "key");
  vi.stubEnv("VAULT_API_TOKEN", "tok");
};
const items = (list: unknown[]) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: list }) })));

// Everything a real Vault record may carry that must never leave the server.
const CONFIDENTIAL = {
  commission: 23456.78,
  commissionRate: 1.9,
  marketingBudget: 8800,
  marketingSpend: 4321,
  appraisal: { low: 700000, high: 760000 },
  agentPriceOpinion: "Vendor expects 780k",
  authorityStart: "2026-01-01",
  authorityExpiry: "2026-07-01",
  vendors: [{ name: "Vendor Person", phone: "0499 999 999", email: "vendor@secret.test" }],
  vendorNotes: "motivated seller",
  internalNotes: "do not share",
  reservePrice: 701000,
};
const LISTING_KEYS = ["id", "address", "suburb", "type", "bed", "bath", "cars", "price", "lat", "lng", "modified", "enquiries30", "hot"].sort();

const prop = (over: Record<string, unknown> = {}) => ({
  id: 101,
  address: { unitNumber: "5", streetNumber: "12", street: "Smith St", suburb: { name: "ST MARYS" } },
  type: { name: "Unit" },
  status: "listing",
  bed: 2,
  bath: 1,
  garages: 1,
  displayPrice: "$650k to $700k",
  searchPrice: 675000,
  geolocation: { latitude: -33.76, longitude: 150.77 },
  modified: "2026-10-01T00:00:00Z",
  ...CONFIDENTIAL,
  ...over,
});

describe("getListings: not-connected paths", () => {
  it("is waiting with no data for other branches without calling Vault", async () => {
    cfg();
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await getListings("bm", []);
    expect(r.status).toBe("waiting");
    expect(r.data).toEqual([]);
    expect(r.note).toBe("Vault listings are only connected for the Penrith branch.");
    expect(spy).not.toHaveBeenCalled();
  });

  it("is waiting with no data for Penrith when credentials are missing", async () => {
    vi.stubEnv("VAULT_API_BASE_URL", "https://vault.test/api");
    const r = await getListings("pen", []);
    expect(r.status).toBe("waiting");
    expect(r.data).toEqual([]);
    expect(r.note).toContain("VAULT_API_BASE_URL");
    expect(r.source).toBe("MRI Vault API");
  });
});

describe("getListings: live path", () => {
  it("whitelists fields: no confidential Vault data is ever present in the output", async () => {
    cfg();
    items([prop()]);
    const r = await getListings("pen", []);
    expect(r.status).toBe("live");
    expect(r.data).toHaveLength(1);
    expect(Object.keys(r.data[0]).sort()).toEqual(LISTING_KEYS);
    const json = JSON.stringify(r);
    for (const secret of ["23456", "1.9", "8800", "4321", "700000", "760000", "Vendor expects", "2026-07-01", "Vendor Person", "0499 999 999", "vendor@secret.test", "motivated", "do not share", "701000"]) {
      expect(json, secret).not.toContain(secret);
    }
    for (const key of Object.keys(CONFIDENTIAL)) expect(json, key).not.toContain(`"${key}"`);
  });

  it("only includes records whose status is 'listing' (not sold, withdrawn, conditional or under offer)", async () => {
    cfg();
    items([
      prop({ id: 1 }),
      prop({ id: 2, status: "sold" }),
      prop({ id: 3, status: "withdrawn" }),
      prop({ id: 4, status: "conditional" }),
      prop({ id: 5, status: "underOffer" }),
      prop({ id: 6, status: undefined }),
    ]);
    expect((await getListings("pen", [])).data.map((l) => l.id)).toEqual(["1"]);
  });

  it("sends both credentials and requests the newest 100", async () => {
    cfg();
    items([]);
    await getListings("pen", []);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://vault.test/api/properties/sale?pagesize=100&sort=modified&sortOrder=desc");
    expect(init.headers).toEqual({ "X-Api-Key": "key", Authorization: "Bearer tok" });
  });

  it("builds the address with and without a unit number", async () => {
    cfg();
    items([
      prop({ id: 1 }),
      prop({ id: 2, address: { streetNumber: "12", street: "Smith St", suburb: { name: "penrith" } } }),
      prop({ id: 3, address: { unitNumber: "7", street: "Lone Rd", suburb: { name: "Kingswood" } } }),
      prop({ id: 4, address: undefined }),
    ]);
    const r = (await getListings("pen", [])).data;
    expect(r.map((l) => l.address)).toEqual(["5/12 Smith St", "12 Smith St", "7/Lone Rd", ""]);
    expect(r.map((l) => l.suburb)).toEqual(["St Marys", "Penrith", "Kingswood", ""]);
  });

  it("derives the price text from displayPrice, then searchPrice, then a fallback", async () => {
    cfg();
    items([prop({ id: 1 }), prop({ id: 2, displayPrice: null }), prop({ id: 3, displayPrice: null, searchPrice: null })]);
    expect((await getListings("pen", [])).data.map((l) => l.price)).toEqual(["$650k to $700k", "$675k", "No price published"]);
  });

  it("maps numeric and location fields, defaulting missing values to null", async () => {
    cfg();
    items([prop({ id: 1 }), prop({ id: 2, bed: null, bath: undefined, garages: undefined, geolocation: null, modified: undefined, type: undefined })]);
    const [a, b] = (await getListings("pen", [])).data;
    expect(a).toMatchObject({ bed: 2, bath: 1, cars: 1, lat: -33.76, lng: 150.77, type: "Unit" });
    expect(b).toMatchObject({ bed: null, bath: null, cars: null, lat: null, lng: null, modified: "", type: "" });
  });

  it("counts enquiries and hot buyers per listing from conversations", async () => {
    cfg();
    items([prop()]);
    const convos = [
      convo({ conversationId: "1", property: "5/12 SMITH ST, ST MARYS", temperature: "Hot" }),
      convo({ conversationId: "2", property: "5/12 smith st, st marys", temperature: "Warm" }),
      convo({ conversationId: "3", property: "99 Other Rd, PENRITH", temperature: "Hot" }),
    ];
    const [l] = (await getListings("pen", convos)).data;
    expect(l.enquiries30).toBe(2);
    expect(l.hot).toBe(1);
  });

  it("stamps source and asOf", async () => {
    cfg();
    items([]);
    const r = await getListings("pen", []);
    expect(r.source).toContain("MRI Vault API");
    expect(Number.isNaN(Date.parse(r.asOf!))).toBe(false);
  });
});

describe("getListings: failure fallback", () => {
  it("is waiting with no data and a note when Vault returns an error status", async () => {
    cfg();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const r = await getListings("pen", []);
    expect(r.status).toBe("waiting");
    expect(r.note).toContain("Vault returned 503");
    expect(r.data).toEqual([]);
    expect(r.note).toMatch(/^Could not read Vault:/);
  });

  it("falls back when the request throws or the body is malformed", async () => {
    cfg();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
    expect((await getListings("pen", [])).note).toContain("timeout");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
    expect((await getListings("pen", [])).status).toBe("waiting");
  });
});
