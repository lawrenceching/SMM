import pino from "pino"
import type { Server as SocketIOServer, Socket } from 'socket.io';

const logger = pino()

export interface WebSocketMessage {
  event: string;
  data?: any;
  requestId?: string; // For backward compatibility, though Socket.IO handles this internally
}

// Store the Socket.IO server instance
let io: SocketIOServer | null = null;

/**
 * Initialize the Socket.IO server instance
 */
export function setSocketIOInstance(socketIO: SocketIOServer): void {
  io = socketIO;
  logger.info('Socket.IO instance initialized in websocketManager');
}

/**
 * Get the Socket.IO server instance
 */
export function getSocketIOInstance(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO instance not initialized. Call setSocketIOInstance first.');
  }
  return io;
}

/**
 * Send a message to all connected clients using Socket.IO broadcast
 */
export function broadcastMessage(message: WebSocketMessage): void {
  if (!io) {
    logger.error('Socket.IO instance not initialized');
    return;
  }

  logger.info({
    event: message.event,
    type: 'broadcast'
  }, 'socket.io message broadcast');

  // Emit to all connected clients
  io.emit(message.event, message.data);
}

/**
 * Send a message to a specific client and wait for acknowledgement
 * @param clientId The clientId (room name) to send to
 * @param message The message to send
 * @param timeoutMs Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with the acknowledgement data
 */
export function sendAndWaitForResponse(
  message: WebSocketMessage,
  responseEvent: string, // Kept for backward compatibility but not used with acknowledgements
  timeoutMs: number = 5000,
  clientId?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!io) {
      reject(new Error('Socket.IO instance not initialized'));
      return;
    }

    // If no clientId provided, use the first available connection
    if (!clientId) {
      const sockets = Array.from(io.sockets.sockets.values());
      if (sockets.length === 0) {
        reject(new Error('No active Socket.IO connections available'));
        return;
      }
      // Use the first socket's clientId
      const firstSocket = sockets[0];
      if (!firstSocket) {
        reject(new Error('No active Socket.IO connections available'));
        return;
      }
      const rooms = Array.from(firstSocket.rooms);
      // Find the room that's not the socket's own ID (which is auto-joined)
      const clientRoom = rooms.find(room => room !== firstSocket.id);
      if (!clientRoom) {
        reject(new Error('No clientId room found for first connection'));
        return;
      }
      clientId = clientRoom;
    }

    // Find the socket(s) in the room
    const socketsInRoom = io.sockets.adapter.rooms.get(clientId);
    
    if (!socketsInRoom || socketsInRoom.size === 0) {
      logger.error({
        clientId,
        event: message.event,
        availableRooms: Array.from(io.sockets.adapter.rooms.keys())
      }, '[DEBUG] no sockets found in room');
      reject(new Error(`No socket found in room: ${clientId}`));
      return;
    }

    // Get the first socket ID from the room
    const socketId = Array.from(socketsInRoom)[0];
    if (!socketId) {
      reject(new Error(`No socket ID found in room: ${clientId}`));
      return;
    }
    const socket = io.sockets.sockets.get(socketId);

    if (!socket) {
      logger.error({
        clientId,
        socketId,
        event: message.event
      }, '[DEBUG] socket not found by ID');
      reject(new Error(`Socket not found: ${socketId}`));
      return;
    }

    const startTime = performance.now();
    logger.info({
      clientId,
      socketId,
      event: message.event,
      timeoutMs,
      data: message.data
    }, '[DEBUG] socket.io sending message to specific socket with acknowledgement');

    // Send to specific socket (not room) with timeout and acknowledgement
    socket.timeout(timeoutMs).emit(message.event, message.data, (err: Error, response: any) => {
      const duration = performance.now() - startTime;
      if (err) {
        logger.error({
          clientId,
          socketId,
          event: message.event,
          error: err.message,
          errorType: typeof err,
          errorDetails: err,
          durationMs: Math.round(duration)
        }, '[DEBUG] socket.io acknowledgement timeout or error');
        reject(new Error(`Socket.IO request timed out or failed: ${err.message}`));
      } else {
        logger.info({
          clientId,
          socketId,
          event: message.event,
          hasResponse: !!response,
          response: response,
          durationMs: Math.round(duration)
        }, '[DEBUG] socket.io acknowledgement received successfully');
        resolve(response);
      }
    });
  });
}

/**
 * Get the first active connection (for single-client scenarios)
 * Returns the clientId if available
 */
export function getFirstActiveConnection(): string | null {
  if (!io) {
    return null;
  }

  const sockets = Array.from(io.sockets.sockets.values());
  if (sockets.length === 0) {
    return null;
  }

  const firstSocket = sockets[0];
  if (!firstSocket) {
    return null;
  }
  const rooms = Array.from(firstSocket.rooms);
  // Find the room that's not the socket's own ID
  const clientRoom = rooms.find(room => room !== firstSocket.id);
  return clientRoom || null;
}

/**
 * Check if a client is connected by clientId
 */
export function isClientConnected(clientId: string): boolean {
  if (!io) {
    return false;
  }

  // Check if any socket is in the clientId room
  const socketsInRoom = io.sockets.adapter.rooms.get(clientId);
  return socketsInRoom !== undefined && socketsInRoom.size > 0;
}

/**
 * Get all connected client IDs
 */
export function getConnectedClientIds(): string[] {
  if (!io) {
    return [];
  }

  const clientIds: string[] = [];
  const sockets = Array.from(io.sockets.sockets.values());

  for (const socket of sockets) {
    const rooms = Array.from(socket.rooms);
    // Find the room that's not the socket's own ID
    const clientRoom = rooms.find(room => room !== socket.id);
    if (clientRoom) {
      clientIds.push(clientRoom);
    }
  }

  return clientIds;
}
