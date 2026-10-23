import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The web app is a static SPA. In production and in `pnpm dev` the API Worker serves
 * the built files; `pnpm dev:web` runs Vite alone and proxies `/api` to the Worker on :8787.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
