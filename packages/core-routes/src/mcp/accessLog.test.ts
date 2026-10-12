import { describe, expect, it } from "vitest";
import type { UserConfig } from "@smm/types";
import {
  createMcpStreamableHttpHandler,
  wrapToolCallbackWithAccessLog,
} from "./createServer.ts";
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

/**
 * Send a JSON-RPC request through the MCP handler and decode the
 * single JSON / last SSE `data:` frame. Same approach as
 * `mcp.test.ts` (stateless transport: initialize first, then call).
 */
async function callMcp(
  handler: Awaited<ReturnType<typeof createMcpStreamableHttpHandler>>,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const request = new Request("http://localhost/mcp/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  const response = await handler(request);
  expect(response.status).toBe(200);
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return JSON.parse(text) as Record<string, unknown>;
  }
  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());
  const lastData = dataLines.at(-1) ?? "";
  expect(lastData).not.toBe("");
  return JSON.parse(lastData) as Record<string, unknown>;
}

const INIT_REQUEST = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0.0.1" },
  },
};

async function makeHandler(getJob: (id: string) => unknown, logger: CoreRoutesLogger) {
  return createMcpStreamableHttpHandler({
    getUserConfig: async () => ({}) as UserConfig,
    appDataDir: "unused-app-data",
    userDataDir: "unused-user-data",
    getJob,
    logger,
  });
}

/** Valid scrape-shaped JobToolPayload passing `getJobOutputSchema`. */
const VALID_SCRAPE_JOB = {
  kind: "scrape",
  id: "j-1",
  folderPath: "D:/media/Show",
  status: "running",
  tasks: {
    poster: { status: "pending" },
    fanart: { status: "pending" },
    thumbnails: { status: "pending" },
    nfo: { status: "pending" },
  },
  createdAt: 0,
  updatedAt: 0,
} as const;

describe("MCP tool access log", () => {
  it("successful tools/call emits one info access entry", async () => {
    const { calls, logger } = makeCaptureLogger();
    const handler = await makeHandler(() => VALID_SCRAPE_JOB, logger);

    await callMcp(handler, INIT_REQUEST);
    const before = calls.filter((c) => c.msg === "access").length;
    const response = await callMcp(handler, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get-job", arguments: { id: "j-1" } },
    });

    expect((response.result as { isError?: boolean }).isError).toBeFalsy();
    const access = calls.filter((c) => c.msg === "access");
    expect(access.length).toBe(before + 1);
    expect(access.at(-1)?.level).toBe("info");
    expect(access.at(-1)?.obj).toMatchObject({
      source: "mcp",
      tool: "get-job",
      outcome: "ok",
    });
    expect(access.at(-1)?.obj.args).toEqual({ id: "j-1" });
    expect(typeof access.at(-1)?.obj.durationMs).toBe("number");
  });

  it("isError tool result emits error-level access entry", async () => {
    const { calls, logger } = makeCaptureLogger();
    const handler = await makeHandler(() => undefined, logger);

    await callMcp(handler, INIT_REQUEST);
    const response = await callMcp(handler, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get-job", arguments: { id: "missing" } },
    });

    expect((response.result as { isError?: boolean }).isError).toBe(true);
    const access = calls.filter((c) => c.msg === "access");
    expect(access.at(-1)?.level).toBe("error");
    expect(access.at(-1)?.obj).toMatchObject({
      source: "mcp",
      tool: "get-job",
      outcome: "error",
    });
  });

  it("callback throwing rethrows the original error and emits err entry", async () => {
    const { calls, logger } = makeCaptureLogger();
    const wrapped = wrapToolCallbackWithAccessLog(
      "get-job",
      async () => {
        throw new Error("boom");
      },
      logger,
    );

    await expect(wrapped({ id: "x" }, undefined)).rejects.toThrow("boom");

    const access = calls.filter((c) => c.msg === "access");
    expect(access).toHaveLength(1);
    expect(access[0]?.level).toBe("error");
    expect(access[0]?.obj.outcome).toBe("error");
    expect((access[0]?.obj.err as { message: string }).message).toBe("boom");
  });
});
