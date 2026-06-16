import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { createSocketIOManager } from "./manager.ts";

describe("createSocketIOManager", () => {
  let server: http.Server | null = null;
  let client: ClientSocket | null = null;

  afterEach(async () => {
    client?.disconnect();
    client = null;

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    }
  });

  it("sends hello on connect and accepts userAgent to join client room", async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });

    const manager = createSocketIOManager(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected server to listen on a port");
    }

    const helloPromise = new Promise<void>((resolve) => {
      client = ioClient(`http://127.0.0.1:${address.port}`, {
        transports: ["websocket"],
        path: "/socket.io/",
      });

      client.on("hello", () => resolve());
    });

    await helloPromise;

    const clientId = "test-client-123";
    client!.emit("userAgent", { userAgent: "vitest", clientId });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(manager.isClientConnected(clientId)).toBe(true);
    expect(manager.getConnectedClientIds()).toContain(clientId);
  });

  it("broadcast reaches connected clients", async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });

    const manager = createSocketIOManager(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected server to listen on a port");
    }

    const clientId = "broadcast-client";
    const payload = { message: "ping-payload" };

    const broadcastReceived = new Promise<unknown>((resolve) => {
      client = ioClient(`http://127.0.0.1:${address.port}`, {
        transports: ["websocket"],
        path: "/socket.io/",
      });

      client.on("hello", () => {
        client!.emit("userAgent", { userAgent: "vitest", clientId });
      });

      client.on("ping", (data) => resolve(data));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    manager.broadcast({ event: "ping", data: payload });

    await expect(broadcastReceived).resolves.toEqual(payload);
  });
});
