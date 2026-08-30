import { defineConfig } from "vitest/config";
import { resolve } from "path";

const typesRoot = resolve(__dirname, "../../packages/types");
const utilsSrc = resolve(__dirname, "../../packages/utils/src");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^@smm\/types\/(.+)$/,
        replacement: `${typesRoot}/$1`,
      },
      {
        find: "@smm/types",
        replacement: resolve(typesRoot, "types.ts"),
      },
      {
        find: /^@smm\/utils\/(.+)$/,
        replacement: `${utilsSrc}/$1`,
      },
      {
        find: "@smm/utils",
        replacement: resolve(utilsSrc, "index.ts"),
      },
      {
        find: "@smm/tvdb4/types",
        replacement: resolve(__dirname, "../../packages/tvdb4/src/types.ts"),
      },
      {
        find: "@smm/tvdb4",
        replacement: resolve(__dirname, "../../packages/tvdb4/src/index.ts"),
      },
      {
        find: "@smm/test",
        replacement: resolve(__dirname, "../../packages/test/src/index.ts"),
      },
    ],
  },
});
