import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const API_PROXY = {
  "/api": { target: process.env.API_ORIGIN ?? "http://localhost:8000", changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  // In production Caddy proxies /api/* to uvicorn. Locally the dev and preview servers do it,
  // so the frontend always talks to a same-origin /api and the session cookie works unchanged.
  server: { port: 5173, proxy: API_PROXY },
  preview: { port: 5173, proxy: API_PROXY },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
