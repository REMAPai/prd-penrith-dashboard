import path from "node:path";

export const PORT = 3100;
export const ENTRA_PORT = 3101;
export const BASE_URL = `http://localhost:${PORT}`;
export const ENTRA_URL = `http://localhost:${ENTRA_PORT}`;

// Test-only values for the throwaway database and the local test server. Never used outside the e2e suite.
export const AUTH_SECRET = "e2e-only-session-secret-0123456789-abcdefghij";
export const E2E_PASSWORD = "E2e-Throwaway-Password-1";
export const INGEST_KEY = "e2e-only-ingest-key-0123456789-abcdefghij";

export const AUTH_DIR = path.join(__dirname, ".auth");
export const RUN_FILE = path.join(AUTH_DIR, "run.json");

export const HAS_DB = !!process.env.TEST_DATABASE_URL;
export const SKIP_MESSAGE = "TEST_DATABASE_URL is not set. The e2e suite only runs against a throwaway Postgres (never DATABASE_URL). See docs/testing/test-plan.md.";

export type E2eRole = "platform_admin" | "company_admin" | "branch_admin" | "marketing" | "agent" | "viewer";

export const E2E_USERS: { key: string; role: E2eRole; email: string; name: string; company: string | null; branch: string | null }[] = [
  { key: "platform_admin", role: "platform_admin", email: "e2e-platform@remap.test", name: "E2E Platform", company: null, branch: null },
  { key: "company_admin", role: "company_admin", email: "e2e-company@prd.test", name: "E2E Company", company: "prd", branch: null },
  { key: "branch_admin", role: "branch_admin", email: "e2e-branch@prd.test", name: "E2E Branch", company: "prd", branch: "pen" },
  { key: "marketing", role: "marketing", email: "e2e-marketing@prd.test", name: "E2E Marketing", company: "prd", branch: "pen" },
  { key: "agent", role: "agent", email: "e2e-agent@prd.test", name: "E2E Agent", company: "prd", branch: "pen" },
  { key: "viewer", role: "viewer", email: "e2e-viewer@prd.test", name: "E2E Viewer", company: "prd", branch: "pen" },
  { key: "bm_viewer", role: "viewer", email: "e2e-mountains@prd.test", name: "E2E Mountains", company: "prd", branch: "bm" },
];

export const stateFile = (key: string) => path.join(AUTH_DIR, `${key}.json`);
export const emailOf = (key: string) => E2E_USERS.find((u) => u.key === key)!.email;
