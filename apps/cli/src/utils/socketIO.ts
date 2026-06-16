import type { Server, Socket } from "socket.io";
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

export function getSocketIOManager(): SocketIOManager {
  if (!manager) {
    throw new Error("Socket.IO manager not initialized. Call setSocketIOManager first.");
  }
  return manager;
}

export function initializeSocketIO(_io: Server): void {
  throw new Error("initializeSocketIO is deprecated; use setSocketIOManager(createSocketIOManager(...))");
}

export function setSocketIOInstance(_socketIO: Server): void {
  throw new Error("setSocketIOInstance is deprecated; use setSocketIOManager(createSocketIOManager(...))");
}

export function getSocketIOInstance(): Server {
  return getSocketIOManager().getSocketIOInstance();
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

export function findSocketByClientId(clientId?: string): { socket: Socket; clientId: string } {
  return getSocketIOManager().findSocketByClientId(clientId);
}

export async function acknowledge(
  message: WebSocketMessage,
  timeoutMs?: number,
): Promise<any> {
  return getSocketIOManager().acknowledge(message, timeoutMs);
}

export function getFirstActiveConnection(): string | null {
  return manager?.getFirstActiveConnection() ?? null;
}

export function isClientConnected(clientId: string): boolean {
  return manager?.isClientConnected(clientId) ?? false;
}

export function getConnectedClientIds(): string[] {
  return manager?.getConnectedClientIds() ?? [];
}
