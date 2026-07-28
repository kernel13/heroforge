import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import icons from "unplugin-icons/vite";

const API_PROXY = {
  "/api": { target: process.env.API_ORIGIN ?? "http://localhost:8000", changeOrigin: true },
};

export default defineConfig({
  // Iconify icons are resolved from `~icons/set/name` at build time, one component per icon, so
  // only the glyphs actually imported reach the bundle and nothing is fetched from
  // api.iconify.design at runtime. `@iconify-json/*` sets are devDependencies: they are build
  // input, not shipped.
  plugins: [react(), tailwindcss(), icons({ compiler: "jsx", jsx: "react" })],
  // `@/` mirrors the tsconfig path alias; shadcn's generated components import through it.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
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
