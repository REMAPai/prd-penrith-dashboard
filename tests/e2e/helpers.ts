import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import pg from "pg";
import { RUN_FILE } from "./constants";

export const runInfo = () => JSON.parse(readFileSync(RUN_FILE, "utf8")) as { address: string; stamp: number };

/** Direct read access to the throwaway database, used only to verify what the UI wrote. */
export async function dbRows<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

/** Collects console errors and uncaught exceptions. Failed third-party map tiles are stubbed by mapTilesOffline. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Answers basemap tile requests locally so the map test never calls a real tile server. */
export async function mapTilesOffline(page: Page) {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.route(/basemaps\.cartocdn\.com/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
