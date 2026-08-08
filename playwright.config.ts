import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the Phase 1 change-request work.
 *
 * These run against a REAL backend + database (whatever `15-jun-26-gen-back`
 * is pointed at), so they are written to be non-destructive: every record they
 * create is uniquely tagged with a run id and cleaned up afterwards.
 *
 * Start both servers first (or let webServer do it):
 *   cd 15-jun-26-gen-back  && npm start
 *   cd 15-jun-26-gen-front && npm run dev
 */
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
