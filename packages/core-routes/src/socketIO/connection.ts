import type { Server, Socket } from "socket.io";
import type { CoreRoutesLogger } from "../types.ts";

function logInfo(logger: CoreRoutesLogger | undefined, obj: Record<string, unknown>, msg: string): void {
  if (logger) {
    logger.info(obj, msg);
  }
}

function logWarn(logger: CoreRoutesLogger | undefined, obj: Record<string, unknown>, msg: string): void {
  if (logger) {
    logger.warn(obj, msg);
  }
}

function logError(logger: CoreRoutesLogger | undefined, obj: Record<string, unknown>, msg: string): void {
  if (logger) {
    logger.error(obj, msg);
  }
}

export function registerSocketIOConnectionHandlers(
  io: Server,
  logger?: CoreRoutesLogger,
): void {
  io.on("connection", (socket: Socket) => {
    logInfo(logger, {
      socketId: socket.id,
      rooms: Array.from(socket.rooms),
    }, "[DEBUG] socket.io connection established");

    socket.emit("hello");

    logInfo(logger, {
      socketId: socket.id,
      event: "hello",
    }, "socket.io message sent");

    socket.on("userAgent", (data: { userAgent?: string; clientId?: string }) => {
      const userAgent = data?.userAgent;
      const clientId = data?.clientId;

      logInfo(logger, {
        socketId: socket.id,
        userAgent,
        clientId,
      }, "[DEBUG] socket.io received userAgent");

      if (clientId) {
        socket.join(clientId);
        const socketsInRoom = io.sockets.adapter.rooms.get(clientId);
        logInfo(logger, {
          socketId: socket.id,
          clientId,
          rooms: Array.from(socket.rooms),
          socketsInRoom: socketsInRoom ? Array.from(socketsInRoom) : [],
        }, "[DEBUG] socket.io client joined room");
      } else {
        logWarn(logger, {
          socketId: socket.id,
        }, "[DEBUG] socket.io userAgent event missing clientId");
      }
    });

    socket.on("disconnect", (reason: string) => {
      logInfo(logger, {
        socketId: socket.id,
        reason,
      }, "socket.io connection closed");
    });

    socket.on("error", (error: Error) => {
      logError(logger, {
        socketId: socket.id,
        error: error.message,
      }, "socket.io connection error");
    });
  });

  logInfo(logger, {}, "Socket.IO connection handlers initialized");
}
