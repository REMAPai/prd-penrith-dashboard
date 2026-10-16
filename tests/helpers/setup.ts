import { beforeEach, vi } from "vitest";
import { createElement } from "react";
import { jar } from "./next";

// Guard rails: no unit test may reach a real external system or inherit real credentials.
const SCRUB = [
  "DATABASE_URL", "TEST_DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "AUTH_FALLBACK_ENABLED", "AUTH_ENTRA_ENABLED", "AUTH_ENTRA_CLIENT_ID",
  "AUTH_ENTRA_CLIENT_SECRET", "AUTH_ENTRA_TENANT_ID", "AUTH_ENTRA_MULTITENANT", "N8N_BASE_URL", "N8N_API_KEY",
  "VAULT_API_BASE_URL", "VAULT_API_KEY", "VAULT_API_TOKEN", "CLICKSEND_USERNAME", "CLICKSEND_API_KEY",
];

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));

beforeEach(() => {
  for (const k of SCRUB) delete process.env[k];
  jar.clear();
  vi.stubGlobal("fetch", async (input: unknown) => {
    throw new Error(`Unmocked network call blocked in tests: ${String(input)}`);
  });
});
