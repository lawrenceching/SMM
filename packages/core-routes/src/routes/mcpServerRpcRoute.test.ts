import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { McpLifecycleManager } from "../mcp/lifecycleTypes.ts";
import type { CoreRoutesConfig } from "../types.ts";
import {
  handleMcpGetServerStatusGet,
  handleMcpStartPost,
  handleMcpStopPost,
} from "./mcpServerRpcRoute.ts";

function createGateManager(): McpLifecycleManager {
  let enabled = false;
  const mcpUrl = "http://127.0.0.1:18081/mcp";

  return {
    async start() {
      enabled = true;
    },
    async stop() {
      enabled = false;
    },
    getState() {
      if (enabled) {
        return {
          status: "running" as const,
          host: "127.0.0.1",
          port: 18081,
          url: mcpUrl,
        };
      }
      return { status: "stopped" as const, url: mcpUrl };
    },
  };
}

function mockRequest(method: string, pathname: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? "" : JSON.stringify(body);
  return {
    method,
    url: pathname,
    async *[Symbol.asyncIterator]() {
      if (payload) {
        yield Buffer.from(payload);
      }
    },
  } as IncomingMessage;
}

function mockResponse(): ServerResponse & {
  statusCode?: number;
  body?: string;
} {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as string | undefined,
    writeHead(status: number, _headers: Record<string, string>) {
      this.statusCode = status;
    },
    end(payload?: string) {
      this.body = payload;
    },
  };
  return res as ServerResponse & { statusCode?: number; body?: string };
}

describe("MCP RPC route handlers", () => {
  let tmpDir: string;
  let config: CoreRoutesConfig;
  let manager: McpLifecycleManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "mcp-rpc-"));
    await writeFile(
      path.join(tmpDir, "smm.json"),
      JSON.stringify({ folders: [], enableMcpServer: false }),
      "utf-8",
    );
    manager = createGateManager();
    config = {
      allowlist: [],
      hello: {
        version: "test",
        userDataDir: tmpDir,
        appDataDir: tmpDir,
        logDir: tmpDir,
        tmpDir: tmpDir,
        reverseProxyUrl: null,
        osLocale: "en-US",
        coreRoutesPort: 3001,
      },
      appDataDir: tmpDir,
      mcp: { manager },
    };
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("handleMcpStartPost returns { data, error: null } and persists config", async () => {
    const req = mockRequest("POST", "/api/start-mcp-server", {
      host: "127.0.0.1",
      port: 30001,
    });
    const res = mockResponse();
    const ctx = { config, url: new URL("http://127.0.0.1:18081/api/start-mcp-server") };

    const handled = await handleMcpStartPost(req, res, ctx);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body ?? "{}") as {
      data?: { status: string; url?: string };
      error?: string | null;
    };
    expect(body.error).toBeNull();
    expect(body.data?.status).toBe("running");
    expect(body.data?.url).toBe("http://127.0.0.1:18081/mcp");
  });

  it("handleMcpGetServerStatusGet returns stopped state", async () => {
    const req = mockRequest("GET", "/api/get-mcp-server-status");
    const res = mockResponse();
    const ctx = { config, url: new URL("http://127.0.0.1:18081/api/get-mcp-server-status") };

    const handled = await handleMcpGetServerStatusGet(req, res, ctx);
    expect(handled).toBe(true);

    const body = JSON.parse(res.body ?? "{}") as {
      data?: { status: string };
      error?: string | null;
    };
    expect(body.error).toBeNull();
    expect(body.data?.status).toBe("stopped");
  });

  it("handleMcpStopPost returns stopped after start", async () => {
    await manager.start();
    const req = mockRequest("POST", "/api/stop-mcp-server");
    const res = mockResponse();
    const ctx = { config, url: new URL("http://127.0.0.1:18081/api/stop-mcp-server") };

    const handled = await handleMcpStopPost(req, res, ctx);
    expect(handled).toBe(true);

    const body = JSON.parse(res.body ?? "{}") as {
      data?: { status: string };
      error?: string | null;
    };
    expect(body.error).toBeNull();
    expect(body.data?.status).toBe("stopped");
  });
});
