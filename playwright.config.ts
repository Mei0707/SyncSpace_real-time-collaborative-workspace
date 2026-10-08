import { defineConfig, devices } from "@playwright/test";

const e2eDataDir =
  process.env.SYNCSPACE_DATA_DIR ?? `.tmp/e2e-data-${Date.now()}`;
const e2eApiPort = process.env.E2E_API_PORT ?? "8877";
const e2eWebPort = process.env.E2E_WEB_PORT ?? "5177";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: `http://localhost:${e2eWebPort}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `SYNCSPACE_DATA_DIR=${e2eDataDir} API_PORT=${e2eApiPort} ./node_modules/.bin/concurrently -k -n api,web -c cyan,green "PORT=${e2eApiPort} npm run dev:api" "API_PORT=${e2eApiPort} npm run dev:web -- --port ${e2eWebPort} --strictPort"`,
    url: `http://localhost:${e2eWebPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
