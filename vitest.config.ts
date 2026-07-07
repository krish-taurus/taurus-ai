import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a Next.js build guard with no runtime meaning; stub it
      // so server-only modules can be unit-tested under Vitest.
      "server-only": fileURLToPath(new URL("./src/tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
