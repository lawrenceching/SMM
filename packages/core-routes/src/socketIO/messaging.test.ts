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
    expect(access[0]?.level).toBe("info");
    expect(access[0]?.obj).toMatchObject({
      source: "socket.io",
      kind: "ack",
      event: "ask-for-rename-files-confirmation",
      clientId: "web-abc",
      outcome: "ok",
    });
    expect(access[0]?.obj.data).toEqual({ files: ["a"] });
    expect(typeof access[0]?.obj.durationMs).toBe("number");
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
    expect(access[0]?.level).toBe("error");
    expect(access[0]?.obj.outcome).toBe("error");
    expect((access[0]?.obj.err as { message: string }).message).toBe(
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
    expect(access[0]?.level).toBe("debug");
    expect(access[0]?.obj).toMatchObject({
      source: "socket.io",
      kind: "broadcast",
      event: "scrape-progress",
      outcome: "ok",
    });
    expect("data" in (access[0]?.obj ?? {})).toBe(false);
  });
});
