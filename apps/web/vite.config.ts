import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * A fresh id per production build (#73): baked into the bundle as `__BUILD_ID__` and written to
 * dist/build.json, which the Worker reads and returns as `X-App-Build`. The Vite dev server uses
 * "dev", which turns the stale-tab check off (its bundle never matches a built dist).
 */
function buildId(id: string): Plugin {
  return {
    name: "prompt-hub-build-id",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build.json",
        source: JSON.stringify({ build: id }),
      });
    },
  };
}

/**
 * The web app is a static SPA. In production and in `pnpm dev` the API Worker serves
 * the built files; `pnpm dev:web` runs Vite alone and proxies `/api` to the Worker on :8787.
 */
export default defineConfig(({ command }) => {
  const id =
    command === "build"
      ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      : "dev";
  return {
    plugins: [react(), buildId(id)],
    define: { __BUILD_ID__: JSON.stringify(id) },
    server: {
      proxy: { "/api": "http://127.0.0.1:8787" },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
