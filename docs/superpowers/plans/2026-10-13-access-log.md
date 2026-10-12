# Access Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 HTTP API / MCP tool / AI tool / Socket.IO 四个调用面实现统一 access log(设计文档:`docs/access-log.md`)。

**Architecture:** 每个调用面一个统一收口点,共享 `packages/core-routes/src/accessLog.ts` 的 `logAccess()` 单一出口。MCP / AI tool / Socket.IO 的 hook 全部在 core-routes 内部(ohos/cli 零改动受益);HTTP 在 `apps/server/server.ts` 的 `http.createServer` 回调接线,helper 放 core-routes 供 ohos 后续复用。输出走 host 注入的现有 pino logger,自动过 `wrapWithMasking` 脱敏。

**Tech Stack:** TypeScript、Vitest 4、`@modelcontextprotocol/sdk`(仅类型)、socket.io 4、pino(经 `CoreRoutesLogger` 接口)。

---

## 全局注意事项(每个任务都适用)

- 当前在 `main` 分支,工作区有**与本计划无关的脏文件**。每个任务 commit 时只 `git add` 该任务列出的文件,禁止 `git add -A` / `git add .`。
- commit message 末尾追加:`Co-Authored-By: Claude Code <noreply@anthropic.com>`
- 运行单个测试文件:`pnpm --filter @smm/core-routes exec vitest run <文件路径>`
- core-routes typecheck:`pnpm --filter @smm/core-routes typecheck`
- `performance` 是全局 API(Node 18+/Bun),无需 import(参照 `packages/core-routes/src/socketIO/messaging.ts` 现有用法)。
- knip 已把 `packages/core-routes` 的 `src/**/*.test.ts` 列为 entry(`knip.json:128-132`),测试文件里的 import 算作使用,按计划中的导出范围导出即可通过 knip,不要扩大导出面。

---

### Task 1: accessLog 核心模块(logAccess / truncateForLog / serializeErrorForLog)

**Files:**
- Create: `packages/core-routes/src/accessLog.ts`
- Test: `packages/core-routes/src/accessLog.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/core-routes/src/accessLog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { logAccess, serializeErrorForLog, truncateForLog } from "./accessLog.ts";
import type { AccessEntry, AccessSource } from "./accessLog.ts";
import type { CoreRoutesLogger } from "./types.ts";

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

function makeEntry(overrides: Partial<AccessEntry> & { source: AccessSource }): AccessEntry {
  return { outcome: "ok", ...overrides };
}

describe("logAccess", () => {
  it("emits ok entries at info level with msg 'access'", () => {
    const { calls, logger } = makeCaptureLogger();
    logAccess(logger, makeEntry({ source: "mcp", tool: "get-job", durationMs: 12 }));
    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe("info");
    expect(calls[0].msg).toBe("access");
    expect(calls[0].obj).toMatchObject({ source: "mcp", tool: "get-job", outcome: "ok", durationMs: 12 });
  });

  it("emits error outcomes at error level", () => {
    const { calls, logger } = makeCaptureLogger();
    logAccess(logger, makeEntry({ source: "http", outcome: "error", status: 404 }));
    expect(calls[0].level).toBe("error");
  });

  it("emits socket.io broadcast entries at debug level even when outcome is ok", () => {
    const { calls, logger } = makeCaptureLogger();
    logAccess(logger, makeEntry({ source: "socket.io", kind: "broadcast", event: "ping" }));
    expect(calls[0].level).toBe("debug");
  });

  it("no-ops silently when logger is undefined", () => {
    expect(() =>
      logAccess(undefined, makeEntry({ source: "mcp", outcome: "error" })),
    ).not.toThrow();
  });

  it("never throws even when the logger itself throws", () => {
    const throwing: CoreRoutesLogger = {
      debug: () => { throw new Error("logger broke"); },
      info: () => { throw new Error("logger broke"); },
      warn: () => { throw new Error("logger broke"); },
      error: () => { throw new Error("logger broke"); },
    };
    expect(() =>
      logAccess(throwing, makeEntry({ source: "mcp", outcome: "error" })),
    ).not.toThrow();
  });
});

describe("truncateForLog", () => {
  it("passes small values through unchanged (same reference)", () => {
    const value = { id: "j-1" };
    expect(truncateForLog(value)).toBe(value);
  });

  it("degrades oversized values to { truncated, preview }", () => {
    const big = { blob: "x".repeat(3000) };
    const result = truncateForLog(big) as { truncated: boolean; preview: string };
    expect(result.truncated).toBe(true);
    expect(result.preview).toHaveLength(2000);
  });

  it("returns '[unserializable]' for cyclic values instead of throwing", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(truncateForLog(cyclic)).toBe("[unserializable]");
  });

  it("respects a custom budget", () => {
    const value = { blob: "x".repeat(100) };
    const result = truncateForLog(value, 10) as { truncated: boolean; preview: string };
    expect(result.truncated).toBe(true);
    expect(result.preview).toHaveLength(10);
  });
});

describe("serializeErrorForLog", () => {
  it("serializes Error to { message, name, stack }", () => {
    const error = new Error("boom");
    const result = serializeErrorForLog(error);
    expect(result.message).toBe("boom");
    expect(result.name).toBe("Error");
    expect(typeof result.stack).toBe("string");
  });

  it("serializes non-Error to { value }", () => {
    expect(serializeErrorForLog("plain failure")).toEqual({ value: "plain failure" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @smm/core-routes exec vitest run src/accessLog.test.ts`
Expected: FAIL,报错为找不到 `./accessLog.ts` 模块。

- [ ] **Step 3: 最小实现**

创建 `packages/core-routes/src/accessLog.ts`:

```ts
import type { CoreRoutesLogger } from "./types.ts";

/** The call surfaces covered by the unified access log (docs/access-log.md). */
export type AccessSource = "http" | "mcp" | "ai-tool" | "socket.io";

/**
 * One completed call on any surface. Emitted as a single pino entry
 * with `msg: "access"` — the stable filter anchor for grep/jq.
 */
export interface AccessEntry {
  source: AccessSource;
  outcome: "ok" | "error";
  durationMs?: number;
  /** mcp / ai-tool */
  tool?: string;
  /** mcp / ai-tool — already passed through `truncateForLog` by callers */
  args?: unknown;
  /** ai-tool, socket.io ack */
  clientId?: string;
  /** http */
  method?: string;
  /** http — pathname without query */
  path?: string;
  /** http — raw query string, only attached when debug is enabled */
  query?: unknown;
  status?: number;
  /** socket.io */
  kind?: "ack" | "broadcast";
  event?: string;
  /** socket.io ack payload — already passed through `truncateForLog` */
  data?: unknown;
  err?: unknown;
  /** http — closed before finish */
  aborted?: boolean;
}

const ACCESS_LOG_MSG = "access";
const DEFAULT_LOG_BUDGET = 2000;

/**
 * Emit one access-log entry. Never throws and silently no-ops without
 * a logger — logging must never break the call path.
 *
 * Level mapping (docs/access-log.md §3.2): outcome=error → error,
 * socket.io broadcast → debug, everything else → info.
 */
export function logAccess(
  logger: CoreRoutesLogger | undefined,
  entry: AccessEntry,
): void {
  if (!logger) return;
  try {
    const level =
      entry.outcome === "error" ? "error" : entry.kind === "broadcast" ? "debug" : "info";
    logger[level](entry, ACCESS_LOG_MSG);
  } catch {
    // Swallow logging failures — never break the request/tool call.
  }
}

/**
 * Safe value for log payloads. Values whose JSON form fits in
 * `budget` pass through unchanged; larger ones degrade to
 * `{ truncated: true, preview }`. Unserializable values (cyclic etc.)
 * become the string `"[unserializable]"`.
 */
export function truncateForLog(value: unknown, budget: number = DEFAULT_LOG_BUDGET): unknown {
  if (value === undefined) return undefined;
  let json: string;
  try {
    json = JSON.stringify(value) ?? String(value);
  } catch {
    return "[unserializable]";
  }
  if (json.length <= budget) return value;
  return { truncated: true, preview: json.slice(0, budget) };
}

/**
 * Error summary for `AccessEntry.err`, mirroring the `serializeError`
 * convention in `chat.ts`: Error → `{ message, name, stack }`,
 * non-Error → `{ value }`.
 */
export function serializeErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }
  return { value: String(error) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @smm/core-routes exec vitest run src/accessLog.test.ts`
Expected: PASS,11 个用例全绿。

- [ ] **Step 5: typecheck + Commit**

Run: `pnpm --filter @smm/core-routes typecheck`
Expected: 无错误。

```bash
git add packages/core-routes/src/accessLog.ts packages/core-routes/src/accessLog.test.ts
git commit -m "feat(core-routes): add access-log core (logAccess/truncateForLog)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: HTTP 收口 helper(attachHttpAccessLog)+ 包导出

**Files:**
- Create: `packages/core-routes/src/accessLogHttp.ts`
- Test: `packages/core-routes/src/accessLogHttp.test.ts`
- Modify: `packages/core-routes/src/index.ts`(文件末尾追加一行导出)

- [ ] **Step 1: 写失败测试**

创建 `packages/core-routes/src/accessLogHttp.test.ts`:

```ts
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { attachHttpAccessLog, shouldLogHttpAccess } from "./accessLogHttp.ts";
import type { CoreRoutesLogger } from "./types.ts";

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

function makeMockReq(url: string, method = "GET"): IncomingMessage {
  return { url, method } as unknown as IncomingMessage;
}

function makeMockRes(statusCode = 200): ServerResponse {
  const res = new EventEmitter() as unknown as ServerResponse & EventEmitter;
  (res as { statusCode: number }).statusCode = statusCode;
  return res;
}

describe("shouldLogHttpAccess", () => {
  it("logs /api/ paths", () => {
    expect(shouldLogHttpAccess("/api/scrape")).toBe(true);
  });

  it("skips /api/log, static assets, socket.io and /proxy", () => {
    expect(shouldLogHttpAccess("/api/log")).toBe(false);
    expect(shouldLogHttpAccess("/index.html")).toBe(false);
    expect(shouldLogHttpAccess("/socket.io/")).toBe(false);
    expect(shouldLogHttpAccess("/proxy/api/chat")).toBe(false);
  });
});

describe("attachHttpAccessLog", () => {
  it("emits one ok info entry on finish", () => {
    const { calls, logger } = makeCaptureLogger();
    const req = makeMockReq("/api/scrape?id=7", "POST");
    const res = makeMockRes(200);
    attachHttpAccessLog(req, res, { logger });

    res.emit("finish");

    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe("info");
    expect(calls[0].obj).toMatchObject({
      source: "http",
      method: "POST",
      path: "/api/scrape",
      status: 200,
      outcome: "ok",
    });
    expect("query" in calls[0].obj).toBe(false);
    expect(typeof calls[0].obj.durationMs).toBe("number");
  });

  it("emits error entry for status >= 400", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(404);
    attachHttpAccessLog(makeMockReq("/api/media-metadata"), res, { logger });
    res.emit("finish");
    expect(calls[0].level).toBe("error");
    expect(calls[0].obj.outcome).toBe("error");
    expect(calls[0].obj.status).toBe(404);
  });

  it("emits aborted error entry on close before finish", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/api/executeCmd", "POST"), res, { logger });

    res.emit("close");

    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe("error");
    expect(calls[0].obj).toMatchObject({ outcome: "error", aborted: true });
  });

  it("does not double-log when close fires after finish", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/api/scrape"), res, { logger });
    res.emit("finish");
    res.emit("close");
    expect(calls).toHaveLength(1);
  });

  it("attaches raw query only when isDebugEnabled is true", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/api/scrape?id=7&lang=zh"), res, {
      logger,
      isDebugEnabled: () => true,
    });
    res.emit("finish");
    expect(calls[0].obj.query).toBe("id=7&lang=zh");
  });

  it("skips non-API paths entirely", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/assets/logo.png"), res, { logger });
    res.emit("finish");
    expect(calls).toHaveLength(0);
  });

  it("no-ops without a logger", () => {
    const res = makeMockRes(200);
    expect(() =>
      attachHttpAccessLog(makeMockReq("/api/scrape"), res, { logger: undefined }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @smm/core-routes exec vitest run src/accessLogHttp.test.ts`
Expected: FAIL,找不到 `./accessLogHttp.ts` 模块。

- [ ] **Step 3: 最小实现**

创建 `packages/core-routes/src/accessLogHttp.ts`:

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { logAccess } from "./accessLog.ts";
import type { CoreRoutesLogger } from "./types.ts";

export interface HttpAccessLogOptions {
  logger: CoreRoutesLogger | undefined;
  /**
   * When true the raw query string is attached to the entry. Hosts
   * pass `() => logger.isLevelEnabled("debug")` so queries (which can
   * carry upstream api keys) never hit info-level smm.log.
   */
  isDebugEnabled?: () => boolean;
}

/**
 * Only API-ish requests are logged. Excludes static assets, the
 * `/socket.io/` polling transport, `/proxy/*` (the loopback `/api/*`
 * hop is logged instead) and the high-frequency `/api/log` beacon.
 */
export function shouldLogHttpAccess(pathname: string): boolean {
  return pathname.startsWith("/api/") && pathname !== "/api/log";
}

/**
 * Attach one `msg:"access"` entry per completed HTTP exchange at the
 * `http.createServer` choke point. Covers both the core-routes
 * dispatch and the Hono sub-app. Logs on `finish`; a `close` before
 * `finish` logs a single aborted entry instead.
 */
export function attachHttpAccessLog(
  req: IncomingMessage,
  res: ServerResponse,
  options: HttpAccessLogOptions,
): void {
  if (!options.logger) return;

  const rawUrl = req.url ?? "/";
  const queryIndex = rawUrl.indexOf("?");
  const path = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  if (!shouldLogHttpAccess(path)) return;

  const method = req.method ?? "GET";
  const started = performance.now();
  let finished = false;

  const emit = (outcome: "ok" | "error", aborted?: boolean) => {
    logAccess(options.logger, {
      source: "http",
      method,
      path,
      status: res.statusCode,
      outcome,
      ...(aborted ? { aborted: true } : {}),
      ...(options.isDebugEnabled?.() && queryIndex !== -1
        ? { query: rawUrl.slice(queryIndex + 1) }
        : {}),
      durationMs: Math.round(performance.now() - started),
    });
  };

  res.on("finish", () => {
    finished = true;
    emit(res.statusCode < 400 ? "ok" : "error");
  });
  res.on("close", () => {
    if (finished) return;
    emit("error", true);
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @smm/core-routes exec vitest run src/accessLogHttp.test.ts`
Expected: PASS,10 个用例全绿。

- [ ] **Step 5: 添加包导出**

在 `packages/core-routes/src/index.ts` 文件末尾追加(只导出跨 workspace 需要的符号,其余保持模块内使用,knip 才不会报 unused export):

```ts
export { attachHttpAccessLog } from "./accessLogHttp.ts";
```

- [ ] **Step 6: typecheck + Commit**

Run: `pnpm --filter @smm/core-routes typecheck`
Expected: 无错误。

```bash
git add packages/core-routes/src/accessLogHttp.ts packages/core-routes/src/accessLogHttp.test.ts packages/core-routes/src/index.ts
git commit -m "feat(core-routes): add HTTP access-log choke-point helper

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: MCP 工具调用 access log(registerTool 中插)

**Files:**
- Modify: `packages/core-routes/src/mcp/createServer.ts`
- Test: `packages/core-routes/src/mcp/accessLog.test.ts`(新建)

**背景**:`createServer.ts` 里所有工具经 `server.registerTool(name, config, cb)` 注册,cb 形如 `async (args: unknown) => Promise<McpToolResponse>`,返回值带协议级 `isError?: boolean`(见 `mcp/types.ts:226-241`)。在 `createMcpStreamableHttpHandler` 内、所有 `register*Tool` 调用前替换 `server.registerTool` 实例属性,即可让 17 个工具一次性带上 access log。

- [ ] **Step 1: 写失败测试**

创建 `packages/core-routes/src/mcp/accessLog.test.ts`:

```ts
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

describe("MCP tool access log", () => {
  it("successful tools/call emits one info access entry", async () => {
    const { calls, logger } = makeCaptureLogger();
    const handler = await makeHandler(() => ({ id: "j-1" }), logger);

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
    expect(access.at(-1)!.level).toBe("info");
    expect(access.at(-1)!.obj).toMatchObject({
      source: "mcp",
      tool: "get-job",
      outcome: "ok",
    });
    expect(access.at(-1)!.obj.args).toEqual({ id: "j-1" });
    expect(typeof access.at(-1)!.obj.durationMs).toBe("number");
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
    expect(access.at(-1)!.level).toBe("error");
    expect(access.at(-1)!.obj).toMatchObject({
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
    expect(access[0].level).toBe("error");
    expect(access[0].obj.outcome).toBe("error");
    expect((access[0].obj.err as { message: string }).message).toBe("boom");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @smm/core-routes exec vitest run src/mcp/accessLog.test.ts`
Expected: FAIL,`createServer.ts` 没有 `wrapToolCallbackWithAccessLog` 导出。

- [ ] **Step 3: 实现**

修改 `packages/core-routes/src/mcp/createServer.ts`:

3a. 顶部 import 区追加两行(`McpConfig` 的 import 已存在,勿动):

```ts
import { logAccess, serializeErrorForLog, truncateForLog } from "../accessLog.ts";
import type { CoreRoutesLogger } from "../types.ts";
```

3b. 在 `createMcpStreamableHttpHandler` 函数定义**之前**(`export type McpRequestHandler` 附近)添加包装工厂:

```ts
/**
 * Callback shape every `register*Tool` call site in this file uses:
 * `(args, extra) => Promise<McpToolResponse>`.
 */
type McpToolCallback = (args: unknown, extra: unknown) => Promise<unknown>;

/**
 * Wrap one MCP tool callback so each invocation emits a single
 * `msg:"access"` entry: args (truncated), outcome derived from the
 * protocol-level `isError` flag, duration — and, when the callback
 * itself throws, the error summary (rethrown unchanged).
 */
export function wrapToolCallbackWithAccessLog(
  toolName: string,
  cb: McpToolCallback,
  logger: CoreRoutesLogger | undefined,
): McpToolCallback {
  return async (args, extra) => {
    const started = performance.now();
    try {
      const result = await cb(args, extra);
      const isError =
        typeof result === "object" &&
        result !== null &&
        "isError" in result &&
        (result as { isError?: unknown }).isError === true;
      logAccess(logger, {
        source: "mcp",
        tool: toolName,
        args: truncateForLog(args),
        outcome: isError ? "error" : "ok",
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      logAccess(logger, {
        source: "mcp",
        tool: toolName,
        args: truncateForLog(args),
        outcome: "error",
        err: serializeErrorForLog(error),
        durationMs: Math.round(performance.now() - started),
      });
      throw error;
    }
  };
}
```

3c. 在 `createMcpStreamableHttpHandler` 内部,`new McpServer(...)` 语句之后、第一个 `register*Tool` 调用(约 L83 `await registerGetApplicationContextTool`)之前插入:

```ts
  // Access log (docs/access-log.md): interpose on `registerTool` so
  // every `tools/call` produces exactly one `msg:"access"` entry.
  // Casts are required because `registerTool` is generic on the SDK
  // side, while every call site passes the same runtime shape
  // `(name, config, async (args) => McpToolResponse)`.
  const rawRegisterTool = server.registerTool.bind(server);
  const registerToolWithAccessLog = (
    name: string,
    toolConfig: Parameters<typeof rawRegisterTool>[1],
    cb: unknown,
  ): ReturnType<typeof rawRegisterTool> =>
    rawRegisterTool(
      name,
      toolConfig,
      wrapToolCallbackWithAccessLog(
        name,
        cb as unknown as McpToolCallback,
        config.logger,
      ) as unknown as Parameters<typeof rawRegisterTool>[2],
    );
  server.registerTool =
    registerToolWithAccessLog as typeof server.registerTool;
```

注意:此处 `config` 是 `createMcpStreamableHttpHandler(config: McpConfig)` 的外层参数(logger 来源),不要与 `toolConfig` 混淆。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @smm/core-routes exec vitest run src/mcp/accessLog.test.ts`
Expected: PASS,3 个用例全绿。

- [ ] **Step 5: 回归已有 MCP 测试**

Run: `pnpm --filter @smm/core-routes exec vitest run src/mcp/`
Expected: PASS(含既有 `mcp.test.ts`、`lifecycle.test.ts` 等)。若有失败,优先排查 `registerTool` 中插是否破坏了注册顺序。

- [ ] **Step 6: typecheck + Commit**

Run: `pnpm --filter @smm/core-routes typecheck`
Expected: 无错误。

```bash
git add packages/core-routes/src/mcp/createServer.ts packages/core-routes/src/mcp/accessLog.test.ts
git commit -m "feat(core-routes): log MCP tool calls via registerTool interposition

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: AI chat 工具 access log(withAccessLog)

**Files:**
- Create: `packages/core-routes/src/tools/toolAccessLog.ts`
- Test: `packages/core-routes/src/tools/toolAccessLog.test.ts`(新建)
- Modify: `packages/core-routes/src/tools/index.ts`(`createChatTools` 返回前包装)

**背景**:chat 工具对象形状为 `{ description, inputSchema, outputSchema?, execute }`(`tools/getJob.ts:65-78`),`execute` 单参数 `args`。`createChatTools()`(`tools/index.ts:112-211`)已解构出 `logger`(L114)与 `clientId`(L113)。

- [ ] **Step 1: 写失败测试**

创建 `packages/core-routes/src/tools/toolAccessLog.test.ts`:

```ts
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
    expect(calls[0].level).toBe("info");
    expect(calls[0].obj).toMatchObject({
      source: "ai-tool",
      tool: "getJob",
      clientId: "c-1",
      outcome: "ok",
    });
    expect(calls[0].obj.args).toEqual({ id: "j-1" });
  });

  it("rethrows the original error and emits an error entry with err", async () => {
    const { calls, logger } = makeCaptureLogger();
    const wrapped = withAccessLog(
      {
        description: "d",
        execute: async () => {
          throw new Error("rename failed");
        },
      },
      "renameFolder",
      { logger, clientId: "c-2" },
    );

    await expect(wrapped.execute({})).rejects.toThrow("rename failed");

    expect(calls[0].level).toBe("error");
    expect(calls[0].obj.outcome).toBe("error");
    expect((calls[0].obj.err as { message: string }).message).toBe("rename failed");
  });

  it("no-ops logging without a logger but still executes", async () => {
    const wrapped = withAccessLog(
      { description: "d", execute: async () => 42 },
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
      getJob: { execute: async () => "job" },
      scrape: { execute: async () => "scraped" },
    };
    const wrapped = withChatToolsAccessLog(tools, { logger, clientId: "c-3" });

    await wrapped.getJob.execute(undefined);
    await wrapped.scrape.execute(undefined);

    const access = calls.filter((c) => c.msg === "access");
    expect(access).toHaveLength(2);
    expect(access.map((c) => c.obj.tool).sort()).toEqual(["getJob", "scrape"]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @smm/core-routes exec vitest run src/tools/toolAccessLog.test.ts`
Expected: FAIL,找不到 `./toolAccessLog.ts` 模块。

- [ ] **Step 3: 最小实现**

创建 `packages/core-routes/src/tools/toolAccessLog.ts`:

```ts
import { logAccess, serializeErrorForLog, truncateForLog } from "../accessLog.ts";
import type { CoreRoutesLogger } from "../types.ts";

export interface AccessLoggedToolContext {
  logger: CoreRoutesLogger | undefined;
  clientId?: string;
}

/**
 * Wrap one chat tool's `execute` so each invocation emits a single
 * `msg:"access"` entry (source "ai-tool"): args (truncated),
 * clientId, outcome, duration. All other tool fields pass through
 * untouched. Rethrows the original error.
 */
export function withAccessLog<
  T extends { execute: (...args: never[]) => Promise<unknown> },
>(tool: T, toolName: string, ctx: AccessLoggedToolContext): T {
  const originalExecute = tool.execute.bind(tool) as (...args: unknown[]) => Promise<unknown>;
  const wrappedExecute = async (...args: unknown[]): Promise<unknown> => {
    const started = performance.now();
    const callArgs = args[0];
    try {
      const result = await originalExecute(...args);
      logAccess(ctx.logger, {
        source: "ai-tool",
        tool: toolName,
        args: truncateForLog(callArgs),
        clientId: ctx.clientId,
        outcome: "ok",
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      logAccess(ctx.logger, {
        source: "ai-tool",
        tool: toolName,
        args: truncateForLog(callArgs),
        clientId: ctx.clientId,
        outcome: "error",
        err: serializeErrorForLog(error),
        durationMs: Math.round(performance.now() - started),
      });
      throw error;
    }
  };
  // The wrapped execute keeps the same runtime signature; the cast
  // preserves the precise per-key ChatTools entry type.
  return { ...tool, execute: wrappedExecute } as T;
}

/**
 * Wrap every tool in a `createChatTools()` result set so a multi-step
 * agent loop is traceable via the shared `clientId`.
 */
export function withChatToolsAccessLog<T extends object>(
  tools: T,
  ctx: AccessLoggedToolContext,
): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      withAccessLog(
        tool as { execute: (...args: never[]) => Promise<unknown> },
        name,
        ctx,
      ),
    ]),
  ) as T;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @smm/core-routes exec vitest run src/tools/toolAccessLog.test.ts`
Expected: PASS,5 个用例全绿。

- [ ] **Step 5: 接入 `createChatTools`**

修改 `packages/core-routes/src/tools/index.ts` 的 `createChatTools()`(L112-211):把 `return { ...19 个条目... };` 改为先赋值再包装返回。保持 19 个条目内容不变,只改首尾:

```ts
  const tools: ChatTools = {
    [GET_APPLICATION_CONTEXT]: buildGetApplicationContextTool(
      // ……以下 19 个条目与原文件完全一致,原样搬入……
    ),
    // ……
    [CREATE_RECOGNIZE_EPISODE_PLAN]: buildCreateRecognizeEpisodePlanTool(
      config.appDataDir,
      fs,
      broadcast,
      logger,
      abortSignal,
      {
        getUserConfig: () => Promise.resolve(userConfig),
        applyRecognizeEpisodePlan: extra?.applyRecognizeEpisodePlan,
      },
    ),
  };

  // Access log (docs/access-log.md): one entry per AI tool execution,
  // tagged with the chat clientId so a multi-step agent loop is traceable.
  return withChatToolsAccessLog(tools, { logger, clientId });
```

并在文件顶部 import 区追加:

```ts
import { withChatToolsAccessLog } from "./toolAccessLog.ts";
```

(`logger` 与 `clientId` 均为函数内已有变量:L113-114。)

- [ ] **Step 6: 回归 chat 相关测试**

Run: `pnpm --filter @smm/core-routes exec vitest run src/chat.test.ts src/chat.streamText.test.ts src/tools/`
Expected: PASS。

- [ ] **Step 7: typecheck + Commit**

Run: `pnpm --filter @smm/core-routes typecheck`
Expected: 无错误。

```bash
git add packages/core-routes/src/tools/toolAccessLog.ts packages/core-routes/src/tools/toolAccessLog.test.ts packages/core-routes/src/tools/index.ts
git commit -m "feat(core-routes): log AI chat tool executions via withAccessLog

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Socket.IO access log(acknowledge / broadcast)

**Files:**
- Modify: `packages/core-routes/src/socketIO/messaging.ts`
- Test: `packages/core-routes/src/socketIO/messaging.test.ts`(新建)

**背景**:`messaging.ts` 的 `broadcast`(L35-42)与 `acknowledge`(L88-136)现各有 1-3 条散装 `logInfo/logDebug/logError` 调用;替换为 access 条目。`logWarn`(L11-13)仍被 `findSocketByClientId`(L74-77)使用,**保留**;`logInfo/logDebug/logError` 替换后删除。

- [ ] **Step 1: 写失败测试**

创建 `packages/core-routes/src/socketIO/messaging.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Server, Socket } from "socket.io";
import { createSocketIOMessaging } from "./messaging.ts";
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
 * Minimal fake of the `io`/`Socket` surface `createSocketIOMessaging`
 * touches: rooms lookup for `findSocketByClientId`, `emitWithAck` for
 * `acknowledge`, `emit` for `broadcast`.
 */
function makeFakeIo(options: {
  clientId: string;
  emitWithAck: (event: string, data: unknown) => Promise<unknown>;
}) {
  const socket = {
    id: "socket-1",
    rooms: new Set(["socket-1", options.clientId]),
    emitWithAck: options.emitWithAck,
    timeout: (_ms: number) => ({ emitWithAck: options.emitWithAck }),
  } as unknown as Socket;

  const io = {
    sockets: {
      sockets: new Map<string, Socket>([["socket-1", socket]]),
      adapter: {
        rooms: new Map<string, Set<string>>([
          [options.clientId, new Set(["socket-1"])],
        ]),
      },
    },
    emit: vi.fn(),
  } as unknown as Server;

  return io;
}

describe("createSocketIOMessaging access log", () => {
  it("acknowledge success emits one info access entry", async () => {
    const { calls, logger } = makeCaptureLogger();
    const io = makeFakeIo({
      clientId: "web-abc",
      emitWithAck: async () => ({ confirmed: true }),
    });
    const messaging = createSocketIOMessaging(io, logger);

    const response = await messaging.acknowledge(
      {
        event: "ask-for-rename-files-confirmation",
        data: { files: ["a"] },
        clientId: "web-abc",
      },
      5000,
    );

    expect(response).toEqual({ confirmed: true });
    const access = calls.filter((c) => c.msg === "access");
    expect(access).toHaveLength(1);
    expect(access[0].level).toBe("info");
    expect(access[0].obj).toMatchObject({
      source: "socket.io",
      kind: "ack",
      event: "ask-for-rename-files-confirmation",
      clientId: "web-abc",
      outcome: "ok",
    });
    expect(access[0].obj.data).toEqual({ files: ["a"] });
    expect(typeof access[0].obj.durationMs).toBe("number");
  });

  it("acknowledge timeout emits one error access entry and rethrows", async () => {
    const { calls, logger } = makeCaptureLogger();
    const io = makeFakeIo({
      clientId: "web-abc",
      emitWithAck: async () => {
        throw new Error("timeout of 5000ms exceeded");
      },
    });
    const messaging = createSocketIOMessaging(io, logger);

    await expect(
      messaging.acknowledge(
        { event: "ask", data: {}, clientId: "web-abc" },
        5000,
      ),
    ).rejects.toThrow("timed out or failed");

    const access = calls.filter((c) => c.msg === "access");
    expect(access).toHaveLength(1);
    expect(access[0].level).toBe("error");
    expect(access[0].obj.outcome).toBe("error");
    expect((access[0].obj.err as { message: string }).message).toBe(
      "timeout of 5000ms exceeded",
    );
  });

  it("broadcast emits one debug access entry without payload", () => {
    const { calls, logger } = makeCaptureLogger();
    const io = makeFakeIo({ clientId: "web-abc", emitWithAck: async () => undefined });
    const messaging = createSocketIOMessaging(io, logger);

    messaging.broadcast({ event: "scrape-progress", data: { pct: 50 } });

    expect(io.emit).toHaveBeenCalledWith("scrape-progress", { pct: 50 });
    const access = calls.filter((c) => c.msg === "access");
    expect(access).toHaveLength(1);
    expect(access[0].level).toBe("debug");
    expect(access[0].obj).toMatchObject({
      source: "socket.io",
      kind: "broadcast",
      event: "scrape-progress",
      outcome: "ok",
    });
    expect("data" in access[0].obj).toBe(false);
  });
});
```

(`WebSocketMessage` 为 `{ event: string; data?: unknown; clientId?: string }`,已核实 `socketIO/types.ts:4-8`,测试构造类型安全。)

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @smm/core-routes exec vitest run src/socketIO/messaging.test.ts`
Expected: FAIL——现有实现不发 access 条目(发的是 `[DEBUG]` 前缀的普通日志),断言 `msg === "access"` 的用例失败。

- [ ] **Step 3: 实现**

修改 `packages/core-routes/src/socketIO/messaging.ts`:

3a. import 区改为(删除 `logInfo/logDebug/logError` 用不到的依赖,新增 accessLog import):

```ts
import type { Server, Socket } from "socket.io";
import type { CoreRoutesLogger } from "../types.ts";
import { logAccess, serializeErrorForLog, truncateForLog } from "../accessLog.ts";
import type { WebSocketMessage } from "./types.ts";
```

3b. 删除 `logInfo`(L5-9)、`logDebug`(L23-27)、`logError`(L17-21)三个 helper,**保留 `logWarn`**。

3c. `broadcast`(L35-42)整体替换为:

```ts
  function broadcast(message: WebSocketMessage): void {
    // Access log replaces the former info log (docs/access-log.md):
    // broadcasts can be high-frequency (job progress), so they are
    // debug-level and carry no payload.
    logAccess(logger, {
      source: "socket.io",
      kind: "broadcast",
      event: message.event,
      outcome: "ok",
    });

    io.emit(message.event, message.data);
  }
```

3d. `acknowledge`(L88-136)函数体中,从 `const startTime = performance.now();` 起到函数末尾替换为:

```ts
    const startTime = performance.now();
    try {
      let response: unknown;

      if (timeoutMs !== undefined && timeoutMs > 0) {
        response = await socket.timeout(timeoutMs).emitWithAck(message.event, message.data);
      } else {
        response = await socket.emitWithAck(message.event, message.data);
      }

      logAccess(logger, {
        source: "socket.io",
        kind: "ack",
        event: message.event,
        clientId,
        data: truncateForLog(message.data),
        outcome: "ok",
        durationMs: Math.round(performance.now() - startTime),
      });

      return response;
    } catch (error) {
      logAccess(logger, {
        source: "socket.io",
        kind: "ack",
        event: message.event,
        clientId,
        outcome: "error",
        err: serializeErrorForLog(error),
        durationMs: Math.round(performance.now() - startTime),
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Socket.IO request timed out or failed: ${errorMessage}`);
    }
```

(`findSocketByClientId` 调用及其 `logWarn` 保持不变。)

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @smm/core-routes exec vitest run src/socketIO/`
Expected: PASS(新测试 + 既有 `manager.test.ts`)。

- [ ] **Step 5: typecheck + Commit**

Run: `pnpm --filter @smm/core-routes typecheck`
Expected: 无错误。

```bash
git add packages/core-routes/src/socketIO/messaging.ts packages/core-routes/src/socketIO/messaging.test.ts
git commit -m "feat(core-routes): emit access-log entries for socket.io ack/broadcast

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: apps/server 接线(HTTP access log + 移除 mcp-cli-diag)

**Files:**
- Modify: `apps/server/server.ts`(createServer 回调,L231-257)
- Modify: `apps/server/src/mcp/mcp.ts`(移除诊断包装,L182-197)

此任务是纯接线,行为由 Task 2 的单元测试覆盖,此处用 typecheck + 全量回归验证。

- [ ] **Step 1: server.ts 接线**

1a. 在 `apps/server/server.ts` 顶部 `@smm/core-routes` 的具名 import 块(L16-30)中加入 `attachHttpAccessLog`(按字母序放在 `applyMcpConfig` 不在同一个块——注意该块从 L16 开始,把 `attachHttpAccessLog,` 插到 `buildReverseProxyPublicUrl,` 之前即可):

```ts
import {
  attachHttpAccessLog,
  buildReverseProxyPublicUrl,
  // ……其余保持不变……
```

1b. 在 `start()` 的 `http.createServer` 回调中,`/socket.io/` 早退之后插入:

```ts
    this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url?.split('?')[0] ?? '';
      const method = req.method ?? 'GET';

      if (url.startsWith('/socket.io/')) {
        return;
      }

      // Unified access log (docs/access-log.md) — covers both the
      // core-routes dispatch and the Hono sub-app at this choke point.
      attachHttpAccessLog(req, res, {
        logger: createHonoLogger(),
        isDebugEnabled: () => logger.isLevelEnabled('debug'),
      });

      if (isExecuteCmdRequest(req)) {
        // ……以下原有代码保持不变……
```

- [ ] **Step 2: 移除 mcp-cli-diag 临时包装**

`apps/server/src/mcp/mcp.ts` 中 `getMcpStreamableHttpHandler` 的 `handlerPromise` 赋值(L182-197),把 `=== DIAGNOSTIC ===` 包装块替换为直接返回:

```ts
  handlerPromise = (async () => {
    const config = await buildMcpConfig();
    return createMcpStreamableHttpHandler(config);
  })();
```

- [ ] **Step 3: 全仓 typecheck**

Run: `pnpm typecheck`
Expected: 无错误(覆盖 apps/server 对新导出的消费)。

- [ ] **Step 4: Commit**

```bash
git add apps/server/server.ts apps/server/src/mcp/mcp.ts
git commit -m "feat(server): wire HTTP access log and drop mcp-cli-diag wrapper

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: 设计文档同步 + 全量 precommit 门禁

**Files:**
- Modify: `docs/access-log.md`

- [ ] **Step 1: 同步 §2.2 文件表**

`docs/access-log.md` §2.2 表格中,把:

```markdown
| `packages/core-routes/src/accessLog.ts`(新建) | `logAccess()`、`truncateForLog()`、`AccessEntry` 类型 |
```

替换为三行:

```markdown
| `packages/core-routes/src/accessLog.ts`(新建) | `logAccess()`、`truncateForLog()`、`serializeErrorForLog()`、`AccessEntry` 类型 |
| `packages/core-routes/src/accessLogHttp.ts`(新建) | HTTP 收口 helper:`attachHttpAccessLog()`、过滤判定 `shouldLogHttpAccess()` |
| `packages/core-routes/src/tools/toolAccessLog.ts`(新建) | AI 工具包装:`withAccessLog()`、`withChatToolsAccessLog()` |
```

并把文档头部的 Status 行改为:

```markdown
> Status: **已实现**(2026-10-13 落地;hook 位置以 §2.2 文件表为准。)
```

- [ ] **Step 2: 运行全量门禁**

Run: `pnpm precommit`
Expected: `typecheck && ui lint && knip && test` 全部通过。若 knip 报 unused export,按报错收紧对应导出(只允许收敛导出面,不允许新增功能)后重跑。

- [ ] **Step 3: Commit**

```bash
git add docs/access-log.md docs/superpowers/plans/2026-10-13-access-log.md
git commit -m "docs: mark access-log design as implemented and sync file layout

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
