import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@core": resolve(__dirname, "../../packages/core"),
      "@smm/core": resolve(__dirname, "../../packages/core/types.ts"),
      "@smm/tvdb4/types": resolve(__dirname, "../../packages/tvdb4/src/types.ts"),
      "@smm/tvdb4": resolve(__dirname, "../../packages/tvdb4/src/index.ts"),
    },
  },
});
