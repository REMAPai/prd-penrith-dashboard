import "server-only";
import type { Conversation, Listing, Result } from "./types";
import { sampleListings } from "./sample";

type VaultProperty = {
  id: number;
  address?: { unitNumber?: string; streetNumber?: string; street?: string; suburb?: { name?: string } };
  type?: { name?: string };
  status?: string;
  bed?: number | null;
  bath?: number | null;
  garages?: number | null;
  displayPrice?: string | null;
  searchPrice?: number | null;
  geolocation?: { latitude?: number; longitude?: number } | null;
  modified?: string;
};

const base = () => process.env.VAULT_API_BASE_URL;
const configured = () => !!base() && !!process.env.VAULT_API_KEY && !!process.env.VAULT_API_TOKEN;

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

// Whitelist only: never pass commission, marketing spend, appraisal, authority dates or vendor details onward.
function toListing(p: VaultProperty): Listing {
  const a = p.address || {};
  const addr = [a.unitNumber && `${a.unitNumber}/`, a.streetNumber, " ", a.street].filter(Boolean).join("").replace("/ ", "/");
  return {
    id: String(p.id),
    address: addr.trim(),
    suburb: titleCase(a.suburb?.name || ""),
    type: p.type?.name || "",
    bed: p.bed ?? null,
    bath: p.bath ?? null,
    cars: p.garages ?? null,
    price: p.displayPrice || (p.searchPrice ? `$${Math.round(p.searchPrice / 1000)}k` : "No price published"),
    lat: p.geolocation?.latitude ?? null,
    lng: p.geolocation?.longitude ?? null,
    modified: p.modified || "",
    enquiries30: 0,
    hot: 0,
  };
}

export async function getListings(branchId: string, convos: Conversation[]): Promise<Result<Listing[]>> {
  if (branchId !== "pen" || !configured()) {
    return { status: "sample", data: sampleListings(branchId), source: "Sample generator" };
  }
  try {
    const res = await fetch(`${base()}/properties/sale?pagesize=100&sort=modified&sortOrder=desc`, {
      headers: { "X-Api-Key": process.env.VAULT_API_KEY!, Authorization: `Bearer ${process.env.VAULT_API_TOKEN}` },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Vault returned ${res.status}`);
    const j = (await res.json()) as { items: VaultProperty[] };
    const live = j.items.filter((p) => p.status === "listing").map(toListing);
    for (const l of live) {
      const key = l.address.toLowerCase();
      const hits = convos.filter((c) => key && c.property.toLowerCase().includes(key));
      l.enquiries30 = hits.length;
      l.hot = hits.filter((c) => c.temperature === "Hot").length;
    }
    return { status: "live", data: live, source: "MRI Vault API (sale properties, current listings)", asOf: new Date().toISOString() };
  } catch (e) {
    return { status: "waiting", data: sampleListings(branchId), source: "MRI Vault API", note: `Could not read Vault: ${e instanceof Error ? e.message : "error"}. Showing sample data.` };
  }
}
