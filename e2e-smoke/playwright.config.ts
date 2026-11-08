import { defineConfig, devices } from "@playwright/test";

// The built app, without MSW, proxying `/api` to a real api (API_PROXY_TARGET); its own port.
const baseURL = "http://localhost:4174";

export default defineConfig({
  testDir: ".",
  // One journey in a fixed order: each test needs what the one before it saved.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: {
    command: "bun run smoke:serve",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
