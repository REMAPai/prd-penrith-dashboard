import { defineConfig, devices } from "@playwright/test";
import { AUTH_SECRET, BASE_URL, ENTRA_PORT, ENTRA_URL, HAS_DB, INGEST_KEY, PORT, SKIP_MESSAGE } from "./tests/e2e/constants";

if (!HAS_DB) console.warn(`\n[e2e] ${SKIP_MESSAGE}\n[e2e] Specs will be skipped.\n`);

const dev = process.env.E2E_DEV === "1";
const url = process.env.TEST_DATABASE_URL ?? "";

// Deliberately no external credentials: every integration stays "not configured" so nothing leaves the machine.
const serverEnv = {
  DATABASE_URL: url,
  AUTH_SECRET,
  AUTH_URL: BASE_URL,
  AUTH_FALLBACK_ENABLED: "true",
  AUTH_ENTRA_ENABLED: "false",
  INGEST_API_KEY: INGEST_KEY,
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: HAS_DB ? "./tests/e2e/global-setup.ts" : undefined,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } },
    },
  ],
  webServer: HAS_DB
    ? [
        {
          command: dev ? `npm run dev -- -p ${PORT}` : `npm run build && npm run start -- -p ${PORT}`,
          url: `${BASE_URL}/login`,
          env: serverEnv,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
          stdout: "pipe",
          stderr: "pipe",
        },
        ...(dev
          ? []
          : [
              {
                // Same build with Microsoft sign-in switched on (placeholder ids, never contacted) to check the button appears.
                command: `npm run start -- -p ${ENTRA_PORT}`,
                url: `${ENTRA_URL}/login`,
                env: { ...serverEnv, AUTH_URL: ENTRA_URL, AUTH_ENTRA_ENABLED: "true", AUTH_ENTRA_CLIENT_ID: "00000000-0000-0000-0000-000000000000", AUTH_ENTRA_CLIENT_SECRET: "placeholder", AUTH_ENTRA_TENANT_ID: "11111111-1111-1111-1111-111111111111" },
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]),
      ]
    : undefined,
});
