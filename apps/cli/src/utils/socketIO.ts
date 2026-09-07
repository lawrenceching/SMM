import type { Socket } from "socket.io";
import type {
  SocketIOManager,
  WebSocketMessage,
} from "@smm/core-routes";
import { logger } from "../../lib/logger";

let manager: SocketIOManager | null = null;

export type { WebSocketMessage };

export function setSocketIOManager(socketManager: SocketIOManager): void {
  manager = socketManager;
}

function getSocketIOManager(): SocketIOManager {
  if (!manager) {
    throw new Error("Socket.IO manager not initialized. Call setSocketIOManager first.");
  }
  return manager;
}

export function broadcast(message: WebSocketMessage): void {
  if (!manager) {
    logger.error("Socket.IO instance not initialized");
    return;
  }
  manager.broadcast(message);
}

export function getFirstAvailableSocket(): { socket: Socket; clientId: string } | null {
  return manager?.getFirstAvailableSocket() ?? null;
}

export async function acknowledge(
  message: WebSocketMessage,
  timeoutMs?: number,
): Promise<any> {
  return getSocketIOManager().acknowledge(message, timeoutMs);
}

