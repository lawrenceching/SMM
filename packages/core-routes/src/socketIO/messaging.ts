import type { Server, Socket } from "socket.io";
import type { CoreRoutesLogger } from "../types.ts";
import type { WebSocketMessage } from "./types.ts";

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

function logDebug(logger: CoreRoutesLogger | undefined, obj: Record<string, unknown>, msg: string): void {
  if (logger) {
    logger.debug(obj, msg);
  }
}

function getClientIdFromSocket(socket: Socket): string | null {
  const rooms = Array.from(socket.rooms);
  return rooms.find((room) => room !== socket.id) ?? null;
}

export function createSocketIOMessaging(io: Server, logger?: CoreRoutesLogger) {
  function broadcast(message: WebSocketMessage): void {
    logInfo(logger, {
      event: message.event,
      type: "broadcast",
    }, "socket.io message broadcast");

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
    logInfo(logger, {
      clientId,
      socketId: socket.id,
      event: message.event,
      timeoutMs: timeoutMs ?? "none",
      data: message.data,
    }, "[DEBUG] socket.io sending message to specific socket with acknowledgement");

    try {
      let response: unknown;

      if (timeoutMs !== undefined && timeoutMs > 0) {
        response = await socket.timeout(timeoutMs).emitWithAck(message.event, message.data);
      } else {
        response = await socket.emitWithAck(message.event, message.data);
      }

      const duration = performance.now() - startTime;
      logDebug(logger, {
        clientId,
        socketId: socket.id,
        event: message.event,
        hasResponse: response !== undefined && response !== null,
        response,
        durationMs: Math.round(duration),
      }, "socket.io acknowledgement received successfully");

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logError(logger, {
        clientId,
        socketId: socket.id,
        event: message.event,
        error: errorMessage,
        errorType: typeof error,
        errorDetails: error,
        durationMs: Math.round(duration),
      }, "[DEBUG] socket.io acknowledgement timeout or error");

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
