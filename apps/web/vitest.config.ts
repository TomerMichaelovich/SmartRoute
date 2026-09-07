import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@smartroute/core": path.resolve(__dirname, "../../packages/core"),
    },
  },
  test: {
    environment: "node",
  },
});
