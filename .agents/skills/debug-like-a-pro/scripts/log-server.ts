/**
 * Standalone HTTP log collector for debug sessions.
 * Uses only Node.js built-in modules (Node / Bun / Deno compatible).
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WriteStream } from "node:fs";

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const DEFAULT_PORT = 28080;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

interface Session {
  id: string;
  path: string;
  stream: WriteStream | null;
  createdAt: string;
  ended: boolean;
}

interface CliOptions {
  port: number;
  timeoutMs: number;
  help: boolean;
}

function printUsage(): void {
  process.stderr.write(`Usage: log-server.ts [options]

Options:
  -p, --port <number>     Port to listen on (default: ${DEFAULT_PORT})
  --timeout <duration>    Auto-shutdown after idle period (default: 15m)
                          Examples: 900000, 30s, 15m, 1h
  -h, --help              Show this help

HTTP API (base: http://127.0.0.1:<port>):
  POST /new       Create session  { id, path }
  POST /log       Write log line  { id, message }
  POST /end       End session     { id }
  GET  /sessions  List sessions
  GET  /shutdown  Shutdown server (deletes all session log files)
  GET  /          Health check

Log files are deleted when the server shuts down (GET /shutdown or --timeout).
`);
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}

function deleteLogFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (isEnoent(err)) return;
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[log-server] Failed to delete ${filePath}: ${message}\n`,
    );
  }
}

function closeWriteStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.once("close", resolve);
    stream.end();
  });
}

function parseDuration(value: string): number {
  const trimmed = value.trim();
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i.exec(trimmed);
  if (!match) {
    throw new Error(`invalid duration: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "ms").toLowerCase();
  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    default:
      throw new Error(`invalid duration unit: ${unit}`);
  }
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "-p" || arg === "--port") {
      const next = argv[++i];
      if (!next) throw new Error("missing value for --port");
      const port = Number(next);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`invalid port: ${next}`);
      }
      options.port = port;
      continue;
    }
    if (arg === "--timeout") {
      const next = argv[++i];
      if (!next) throw new Error("missing value for --timeout");
      options.timeoutMs = parseDuration(next);
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function formatTimeoutLabel(ms: number): string {
  if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}h`;
  if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}m`;
  if (ms % 1000 === 0) return `${ms / 1000}s`;
  return `${ms}ms`;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload, "utf8"),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new HttpError(400, "request body is required");
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function assertStringField(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `"${field}" must be a non-empty string`);
  }
  return value;
}

function validateId(id: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new HttpError(
      400,
      `"id" must consist of letters, digits, "-", or "_"`,
    );
  }
}

function ensureLine(message: string): string {
  return message.endsWith("\n") ? message : `${message}\n`;
}

function createSessionStore() {
  const sessions = new Map<string, Session>();

  function openSession(id: string, filePath: string): Session {
    validateId(id);
    if (sessions.has(id)) {
      throw new HttpError(409, `session already exists: ${id}`);
    }

    const dir = path.dirname(filePath);
    if (dir && dir !== ".") {
      fs.mkdirSync(dir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath, {
      flags: "a",
      encoding: "utf8",
    });

    const session: Session = {
      id,
      path: filePath,
      stream,
      createdAt: new Date().toISOString(),
      ended: false,
    };
    sessions.set(id, session);
    return session;
  }

  function getActiveSession(id: string): Session {
    const session = sessions.get(id);
    if (!session) {
      throw new HttpError(404, `session not found: ${id}`);
    }
    if (session.ended || !session.stream) {
      throw new HttpError(400, `session is not active: ${id}`);
    }
    return session;
  }

  function writeLog(id: string, message: string): void {
    const session = getActiveSession(id);
    const line = ensureLine(message);
    session.stream!.write(line);
  }

  function closeSession(id: string): void {
    const session = sessions.get(id);
    if (!session) {
      throw new HttpError(404, `session not found: ${id}`);
    }
    if (session.ended) {
      throw new HttpError(400, `session already ended: ${id}`);
    }
    session.stream?.end();
    session.stream = null;
    session.ended = true;
  }

  async function closeAllSessionsAndDeleteLogs(): Promise<void> {
    const paths = [...new Set([...sessions.values()].map((s) => s.path))];
    const closePromises: Promise<void>[] = [];

    for (const session of sessions.values()) {
      if (session.stream) {
        const stream = session.stream;
        closePromises.push(
          closeWriteStream(stream).then(() => {
            session.stream = null;
            session.ended = true;
          }),
        );
      }
    }

    await Promise.all(closePromises);

    for (const filePath of paths) {
      deleteLogFile(filePath);
    }
    sessions.clear();
  }

  function listSessions(): Array<{
    id: string;
    path: string;
    active: boolean;
    createdAt: string;
  }> {
    return [...sessions.values()].map((s) => ({
      id: s.id,
      path: s.path,
      active: !s.ended,
      createdAt: s.createdAt,
    }));
  }

  return {
    openSession,
    writeLog,
    closeSession,
    closeAllSessionsAndDeleteLogs,
    listSessions,
  };
}

function main(): void {
  let options: CliOptions = {
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n\n`);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const store = createSessionStore();
  let shuttingDown = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutLabel = formatTimeoutLabel(options.timeoutMs);

  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    process.stderr.write(`[log-server] Shutting down: ${reason}\n`);
    await store.closeAllSessionsAndDeleteLogs();

    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => process.exit(0), 1000).unref();
  };

  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (shuttingDown) {
      sendJson(res, 503, { error: "server is shutting down" });
      return;
    }

    const host = req.headers.host ?? `127.0.0.1:${options.port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const route = url.pathname;

    try {
      if (req.method === "GET" && route === "/") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && route === "/sessions") {
        sendJson(res, 200, { sessions: store.listSessions() });
        return;
      }

      if (req.method === "GET" && route === "/shutdown") {
        sendJson(res, 200, { ok: true, message: "shutting down" });
        void shutdown("shutdown requested via GET /shutdown");
        return;
      }

      if (req.method === "POST" && route === "/new") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const id = assertStringField(body, "id");
        const filePath = assertStringField(body, "path");
        validateId(id);
        store.openSession(id, filePath);
        sendJson(res, 201, { id, path: filePath });
        return;
      }

      if (req.method === "POST" && route === "/log") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const id = assertStringField(body, "id");
        const message = assertStringField(body, "message");
        validateId(id);
        store.writeLog(id, message);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && route === "/end") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const id = assertStringField(body, "id");
        validateId(id);
        store.closeSession(id);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  };

  const server = http.createServer((req, res) => {
    void handler(req, res);
  });

  server.listen(options.port, "127.0.0.1", () => {
    process.stderr.write(
      `[log-server] Listening on http://127.0.0.1:${options.port} (timeout: ${timeoutLabel})\n`,
    );
  });

  timeoutHandle = setTimeout(() => {
    void shutdown(`idle timeout reached (--timeout ${timeoutLabel})`);
  }, options.timeoutMs);
  if (
    timeoutHandle !== null &&
    typeof timeoutHandle === "object" &&
    "unref" in timeoutHandle &&
    typeof (timeoutHandle as { unref: () => void }).unref === "function"
  ) {
    (timeoutHandle as { unref: () => void }).unref();
  }
}

main();
