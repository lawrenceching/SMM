import type { Server, Socket } from "socket.io";
import type { CoreRoutesLogger } from "../types.ts";
import { logAccess, serializeErrorForLog, truncateForLog } from "../accessLog.ts";
import type { WebSocketMessage } from "./types.ts";

function logWarn(logger: CoreRoutesLogger | undefined, obj: Record<string, unknown>, msg: string): void {
  if (logger) {
    logger.warn(obj, msg);
  }
}

function getClientIdFromSocket(socket: Socket): string | null {
  const rooms = Array.from(socket.rooms);
  return rooms.find((room) => room !== socket.id) ?? null;
}

export function createSocketIOMessaging(io: Server, logger?: CoreRoutesLogger) {
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

  function getFirstAvailableSocket(): { socket: Socket; clientId: string } | null {
    const sockets = Array.from(io.sockets.sockets.values());
    if (sockets.length === 0) {
      return null;
    }

    for (const socket of sockets) {
      const foundClientId = getClientIdFromSocket(socket);
      if (foundClientId) {
        return { socket, clientId: foundClientId };
      }
    }

    return null;
  }

  function findSocketByClientId(clientId?: string): { socket: Socket; clientId: string } {
    if (clientId) {
      const socketsInRoom = io.sockets.adapter.rooms.get(clientId);

      if (socketsInRoom && socketsInRoom.size > 0) {
        const socketId = Array.from(socketsInRoom)[0];
        if (socketId) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            return { socket, clientId };
          }
        }
      }

      logWarn(logger, {
        clientId,
        availableRooms: Array.from(io.sockets.adapter.rooms.keys()),
      }, "[DEBUG] no sockets found in specified room, falling back to first available socket");
    }

    const result = getFirstAvailableSocket();
    if (!result) {
      throw new Error("No active Socket.IO connections available");
    }

    return result;
  }

  async function acknowledge(message: WebSocketMessage, timeoutMs?: number): Promise<unknown> {
    const { socket, clientId } = findSocketByClientId(message.clientId);

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
  }

  function getFirstActiveConnection(): string | null {
    const sockets = Array.from(io.sockets.sockets.values());
    if (sockets.length === 0) {
      return null;
    }

    const firstSocket = sockets[0];
    if (!firstSocket) {
      return null;
    }

    const clientRoom = Array.from(firstSocket.rooms).find((room) => room !== firstSocket.id);
    return clientRoom ?? null;
  }

  function isClientConnected(clientId: string): boolean {
    const socketsInRoom = io.sockets.adapter.rooms.get(clientId);
    return socketsInRoom !== undefined && socketsInRoom.size > 0;
  }

  function getConnectedClientIds(): string[] {
    const clientIds: string[] = [];
    const sockets = Array.from(io.sockets.sockets.values());

    for (const socket of sockets) {
      const clientRoom = Array.from(socket.rooms).find((room) => room !== socket.id);
      if (clientRoom) {
        clientIds.push(clientRoom);
      }
    }

    return clientIds;
  }

  return {
    broadcast,
    acknowledge,
    getFirstAvailableSocket,
    findSocketByClientId,
    getFirstActiveConnection,
    isClientConnected,
    getConnectedClientIds,
  };
}
