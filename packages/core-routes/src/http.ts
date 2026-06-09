import type { IncomingMessage, ServerResponse } from "node:http";

export function createRequestUrl(req: IncomingMessage, fallbackPort: number): URL {
  const host = req.headers.host ?? `127.0.0.1:${fallbackPort}`;
  return new URL(req.url ?? "/", `http://${host}`);
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload, "utf8"),
  });
  res.end(payload);
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

export function parseBooleanQuery(value: string | null | undefined): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value === "true";
}
