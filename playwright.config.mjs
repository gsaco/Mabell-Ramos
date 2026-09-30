import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4194/Mabell-Ramos/",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command:
        "PORT=4194 LOCAL_RECEIVER_PORT=8794 node tools/dev-server.mjs --local-receiver",
      url: "http://127.0.0.1:4194/Mabell-Ramos/",
      reuseExistingServer: false,
    },
    {
      command:
        "node services/inquiry-receiver/local-server.mjs --enable-local --catalog site-src/content/catalog-public.json --port 8794 --data-dir .local-data/e2e --origins http://127.0.0.1:4194 --privacy-version local-preview-v1",
      url: "http://127.0.0.1:8794/health",
      reuseExistingServer: false,
    },
    {
      command:
        "PORT=4195 LOCAL_RECEIVER_PORT=8794 SITE_OUTPUT_DIR=.local-data/fixture-site node tools/dev-server.mjs --local-receiver",
      url: "http://127.0.0.1:4195/Mabell-Ramos/",
      reuseExistingServer: false,
    },
  ],
});
