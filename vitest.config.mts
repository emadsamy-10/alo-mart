import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    // next-intl imports `next/server` extensionless; let Vite resolve it.
    server: { deps: { inline: ["next-intl"] } },
  },
});
