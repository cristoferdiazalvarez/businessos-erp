import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
const production = process.env.E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `corepack pnpm --filter @businessos/api ${production ? "start" : "dev"}`,
      url: "http://localhost:4000/api/docs",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `corepack pnpm --filter @businessos/web ${production ? "start" : "dev"}`,
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
