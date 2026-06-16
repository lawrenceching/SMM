import type { Server, Socket } from "socket.io";
import type { CoreRoutesLogger } from "../types.ts";

export interface WebSocketMessage {
  event: string;
  data?: unknown;
  clientId?: string;
}

export interface SocketIOCorsConfig {
  origin: string;
  methods: string[];
}

export interface SocketIOConfig {
  logger?: CoreRoutesLogger;
  cors?: SocketIOCorsConfig;
  /** Socket.IO path; default `/socket.io/` */
  path?: string;
}

export interface SocketIOManager {
  io: Server;
  broadcast(message: WebSocketMessage): void;
  acknowledge(message: WebSocketMessage, timeoutMs?: number): Promise<unknown>;
  getSocketIOInstance(): Server;
  getFirstAvailableSocket(): { socket: Socket; clientId: string } | null;
  findSocketByClientId(clientId?: string): { socket: Socket; clientId: string };
  getFirstActiveConnection(): string | null;
  isClientConnected(clientId: string): boolean;
  getConnectedClientIds(): string[];
}
