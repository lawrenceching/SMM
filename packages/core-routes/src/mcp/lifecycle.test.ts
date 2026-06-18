import { describe, it, expect } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  applyMcpLifecycleFromConfig,
  doMcpGetStatus,
  doMcpStart,
  doMcpStop,
} from "./lifecycle.ts";
import type { McpLifecycleManager, McpServerState } from "./lifecycleTypes.ts";
import {
  handleMcpStartPut,
  handleMcpStopPut,
  handleMcpStatusGet,
} from "../routes/mcpLifecycleRoute.ts";
import type { CoreRoutesConfig } from "../types.ts";

function createMockManager(
  initial: McpServerState = { status: "stopped" },
): McpLifecycleManager & { states: McpServerState[] } {
  let state = { ...initial };
  return {
    states: [],
    async start(options) {
      state = {
        status: "running",
        host: options?.hostname ?? "127.0.0.1",
        port: options?.port ?? 30001,
        url: `http://${options?.hostname ?? "127.0.0.1"}:${options?.port ?? 30001}/mcp`,
      };
      this.states.push(state);
    },
    async stop() {
      state = { status: "stopped" };
      this.states.push(state);
    },
    getState() {
      return { ...state };
    },
  };
}

function mockRequest(method: string, body?: unknown): IncomingMessage {
  const payload =
    body === undefined ? "" : JSON.stringify(body);
  return {
    method,
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

describe("MCP lifecycle pure functions", () => {
  it("doMcpStart returns running state on success", async () => {
    const manager = createMockManager();
    const result = await doMcpStart(manager, { host: "127.0.0.1", port: 30002 });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("running");
    expect(result.body.url).toBe("http://127.0.0.1:30002/mcp");
  });

  it("doMcpStart returns 500 when manager throws", async () => {
    const manager: McpLifecycleManager = {
      async start() {
        throw new Error("port in use");
      },
      async stop() {},
      getState: () => ({ status: "error", error: "port in use" }),
    };
    const result = await doMcpStart(manager, {});
    expect(result.status).toBe(500);
    expect(result.body.error).toBe("port in use");
  });

  it("doMcpStop returns stopped state", async () => {
    const manager = createMockManager({ status: "running", port: 30001 });
    await manager.start();
    const result = await doMcpStop(manager);
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("stopped");
  });

  it("doMcpGetStatus returns current state", () => {
    const manager = createMockManager({ status: "running", url: "http://127.0.0.1:18081/mcp" });
    const result = doMcpGetStatus(manager);
    expect(result.body.url).toBe("http://127.0.0.1:18081/mcp");
  });

  it("applyMcpLifecycleFromConfig starts when enableMcpServer is true", async () => {
    const manager = createMockManager();
    await applyMcpLifecycleFromConfig(
      manager,
      async () =>
        ({
          enableMcpServer: true,
          mcpHost: "127.0.0.1",
          mcpPort: 30001,
        }) as never,
    );
    expect(manager.getState().status).toBe("running");
  });

  it("applyMcpLifecycleFromConfig stops when enableMcpServer is false", async () => {
    const manager = createMockManager({ status: "running" });
    await manager.start();
    await applyMcpLifecycleFromConfig(
      manager,
      async () => ({ enableMcpServer: false }) as never,
    );
    expect(manager.getState().status).toBe("stopped");
  });
});

describe("MCP lifecycle HTTP routes", () => {
  const manager = createMockManager();

  const ctx = {
    config: { allowlist: [], mcp: { manager } } satisfies CoreRoutesConfig,
    url: new URL("http://127.0.0.1:3000/api/mcp/start"),
  };

  it("handleMcpStartPut starts server", async () => {
    const req = mockRequest("PUT", { host: "127.0.0.1", port: 30002 });
    const res = mockResponse();
    const handled = await handleMcpStartPut(req, res, ctx);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as McpServerState;
    expect(body.status).toBe("running");
  });

  it("handleMcpStatusGet returns state", async () => {
    const req = mockRequest("GET");
    const res = mockResponse();
    const handled = await handleMcpStatusGet(req, res, {
      ...ctx,
      url: new URL("http://127.0.0.1:3000/api/mcp/status"),
    });
    expect(handled).toBe(true);
    expect(JSON.parse(res.body ?? "{}").status).toBe("running");
  });

  it("handleMcpStopPut stops server", async () => {
    const req = mockRequest("PUT");
    const res = mockResponse();
    const handled = await handleMcpStopPut(req, res, {
      ...ctx,
      url: new URL("http://127.0.0.1:3000/api/mcp/stop"),
    });
    expect(handled).toBe(true);
    expect(JSON.parse(res.body ?? "{}").status).toBe("stopped");
  });

  it("returns not configured when manager is missing", async () => {
    const req = mockRequest("GET");
    const res = mockResponse();
    await handleMcpStatusGet(req, res, {
      config: { allowlist: [] },
      url: new URL("http://127.0.0.1:3000/api/mcp/status"),
    });
    expect(JSON.parse(res.body ?? "{}").error).toBe("MCP lifecycle not configured");
  });
});
