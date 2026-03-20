import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 30000,
  },
});
