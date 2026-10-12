import { describe, expect, it } from "vitest";
import { withAccessLog, withChatToolsAccessLog } from "./toolAccessLog.ts";
import type { CoreRoutesLogger } from "../types.ts";

function makeCaptureLogger() {
  const calls: Array<{ level: string; obj: Record<string, unknown>; msg?: string }> = [];
  const logger: CoreRoutesLogger = {
    debug: (obj, msg) => calls.push({ level: "debug", obj, msg }),
    info: (obj, msg) => calls.push({ level: "info", obj, msg }),
    warn: (obj, msg) => calls.push({ level: "warn", obj, msg }),
    error: (obj, msg) => calls.push({ level: "error", obj, msg }),
  };
  return { calls, logger };
}

describe("withAccessLog", () => {
  it("returns the result unchanged and emits one info entry", async () => {
    const { calls, logger } = makeCaptureLogger();
    const tool = {
      description: "d",
      inputSchema: { z: "schema" },
      execute: async (args: unknown) => ({ ok: true, args }),
    };
    const wrapped = withAccessLog(tool, "getJob", { logger, clientId: "c-1" });

    const result = await wrapped.execute({ id: "j-1" });

    expect(result).toEqual({ ok: true, args: { id: "j-1" } });
    expect(wrapped.description).toBe("d");
    expect(wrapped.inputSchema).toEqual({ z: "schema" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.level).toBe("info");
    expect(calls[0]?.obj).toMatchObject({
      source: "ai-tool",
      tool: "getJob",
      clientId: "c-1",
      outcome: "ok",
    });
    expect(calls[0]?.obj.args).toEqual({ id: "j-1" });
  });

  it("rethrows the original error and emits an error entry with err", async () => {
    const { calls, logger } = makeCaptureLogger();
    const wrapped = withAccessLog(
      {
        description: "d",
        execute: async (_args: unknown) => {
          throw new Error("rename failed");
        },
      },
      "renameFolder",
      { logger, clientId: "c-2" },
    );

    await expect(wrapped.execute({})).rejects.toThrow("rename failed");

    expect(calls[0]?.level).toBe("error");
    expect(calls[0]?.obj.outcome).toBe("error");
    expect((calls[0]?.obj.err as { message: string }).message).toBe("rename failed");
  });

  it("no-ops logging without a logger but still executes", async () => {
    const wrapped = withAccessLog(
      { description: "d", execute: async (_args: unknown) => 42 },
      "getJob",
      { logger: undefined },
    );
    await expect(wrapped.execute({})).resolves.toBe(42);
  });
});

describe("withChatToolsAccessLog", () => {
  it("wraps every tool in the map, preserving keys", async () => {
    const { calls, logger } = makeCaptureLogger();
    const tools = {
      getJob: { execute: async (_args: unknown) => "job" },
      scrape: { execute: async (_args: unknown) => "scraped" },
    };
    const wrapped = withChatToolsAccessLog(tools, { logger, clientId: "c-3" });

    await wrapped.getJob.execute(undefined);
    await wrapped.scrape.execute(undefined);

    const access = calls.filter((c) => c.msg === "access");
    expect(access).toHaveLength(2);
    expect(access.map((c) => c.obj.tool).sort()).toEqual(["getJob", "scrape"]);
  });
});
