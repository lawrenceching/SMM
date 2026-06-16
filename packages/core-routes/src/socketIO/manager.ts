import type http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { registerSocketIOConnectionHandlers } from "./connection.ts";
import { createSocketIOMessaging } from "./messaging.ts";
import type { SocketIOConfig, SocketIOManager, SocketIOCorsConfig } from "./types.ts";

const DEFAULT_CORS: SocketIOCorsConfig = {
  origin: "*",
  methods: ["GET", "POST"],
};

export function createSocketIOManager(
  httpServer: http.Server,
  config: SocketIOConfig = {},
): SocketIOManager {
  const cors = config.cors ?? DEFAULT_CORS;

  const io = new SocketIOServer(httpServer, {
    cors,
    path: config.path ?? "/socket.io/",
  });

  registerSocketIOConnectionHandlers(io, config.logger);

  const messaging = createSocketIOMessaging(io, config.logger);

  return {
    io,
    broadcast: messaging.broadcast,
    acknowledge: messaging.acknowledge,
    getSocketIOInstance: () => io,
    getFirstAvailableSocket: messaging.getFirstAvailableSocket,
    findSocketByClientId: messaging.findSocketByClientId,
    getFirstActiveConnection: messaging.getFirstActiveConnection,
    isClientConnected: messaging.isClientConnected,
    getConnectedClientIds: messaging.getConnectedClientIds,
  };
}
