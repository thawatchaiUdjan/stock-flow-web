import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // The e2e build alone carries MSW's service worker: production never ships it (ADR 0011).
  const e2e = mode === "e2e";

  return {
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routeFileIgnorePattern: String.raw`\.test\.`,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    publicDir: e2e ? "e2e/public" : "public",
    build: { outDir: e2e ? "dist-e2e" : "dist" },
    server: {
      proxy: {
        // Same shape as vercel.json's rewrite: the api has no /api prefix of its own.
        "/api": {
          target: env.API_PROXY_TARGET ?? "http://localhost:8080",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      // Times are shown in the visitor's zone; tests assert them in this one.
      env: { TZ: "UTC" },
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
