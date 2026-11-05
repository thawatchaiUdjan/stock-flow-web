import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: { command: "bun run e2e:serve", url: baseURL, reuseExistingServer: !process.env.CI },
});
