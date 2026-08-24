import { defineConfig } from "vitest/config";
import { resolve } from "path";

const coreRoot = resolve(__dirname, "../../packages/core");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: "@core", replacement: coreRoot },
      // Subpaths (`@smm/core/path`, …) must win over bare `@smm/core` → types.ts.
      {
        find: /^@smm\/core\/(.+)$/,
        replacement: `${coreRoot}/$1`,
      },
      {
        find: "@smm/core",
        replacement: resolve(coreRoot, "types.ts"),
      },
      {
        find: "@smm/tvdb4/types",
        replacement: resolve(__dirname, "../../packages/tvdb4/src/types.ts"),
      },
      {
        find: "@smm/tvdb4",
        replacement: resolve(__dirname, "../../packages/tvdb4/src/index.ts"),
      },
    ],
  },
});
