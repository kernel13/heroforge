import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    /**
     * Pinned, so the browser's own preference cannot choose the interface language for us.
     *
     * On first visit the application takes `navigator.languages`, which is the right behaviour
     * for a user and the wrong one for a suite: a French-configured machine would run every
     * `getByLabel` in this file against a French sheet.
     */
    locale: "en-GB",
  },
});
