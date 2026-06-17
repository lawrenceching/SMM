import { readFile, writeFile, stat } from "node:fs/promises";
import type { ChatFs } from "./chatTypes.ts";

/**
 * Default {@link ChatFs} implementation backed by `node:fs/promises`.
 * Works for both Node.js (OHOS Electron Main) and Bun (cli) — Bun
 * implements `node:fs/promises` natively, so this is the cross-runtime
 * choice. The original `ChatTask.ts` used `Bun.file` / `Bun.write`
 * for hot-path readability; this implementation is the same shape
 * (`readJson`, `writeJson`, `exists`) so the tool code is identical
 * across runtimes.
 */
export function defaultChatFs(): ChatFs {
  return {
    async readJson<T = unknown>(filePath: string): Promise<T | null> {
      try {
        const contents = await readFile(filePath, "utf-8");
        return JSON.parse(contents) as T;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },

    async writeJson(filePath: string, value: unknown): Promise<void> {
      const serialized = JSON.stringify(value, null, 2);
      await writeFile(filePath, serialized, "utf-8");
    },

    async exists(filePath: string): Promise<boolean> {
      try {
        await stat(filePath);
        return true;
      } catch {
        return false;
      }
    },
  };
}
