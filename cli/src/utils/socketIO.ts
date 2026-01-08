import pino from "pino"
import type { Server as SocketIOServer, Socket } from 'socket.io';

const logger = pino()

export interface WebSocketMessage {
  /**
   * The event name
   */
  event: string;
  /**
   * The event data (payload)
   */
  data?: any;

  /**
   * The SMM client id
   */
  clientId?: string;
}

// Store the Socket.IO server instance
let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO connection handlers
 * Sets up event listeners for connection, disconnection, and messages
 */
export function initializeSocketIO(io: SocketIOServer): void {
  // Store the Socket.IO instance in websocketManager
  setSocketIOInstance(io);

  io.on('connection', (socket: Socket) => {
    logger.info({
      socketId: socket.id,
      rooms: Array.from(socket.rooms)
    }, '[DEBUG] socket.io connection established');

    // Send "hello" event immediately when connection is established
    socket.emit('hello');
    logger.info({
      socketId: socket.id,
      event: 'hello'
    }, 'socket.io message sent');

    // Handle userAgent event - client sends this with their clientId
    socket.on('userAgent', (data: any) => {
      const userAgent = data?.userAgent;
      const clientId = data?.clientId;

      logger.info({
        socketId: socket.id,
        userAgent,
        clientId
      }, '[DEBUG] socket.io received userAgent');

      // Join the client to a room with their clientId
      if (clientId) {
        socket.join(clientId);
        const roomsAfterJoin = Array.from(socket.rooms);
        const socketsInRoom = io.sockets.adapter.rooms.get(clientId);
        logger.info({
          socketId: socket.id,
          clientId,
          rooms: roomsAfterJoin,
          socketsInRoom: socketsInRoom ? Array.from(socketsInRoom) : []
        }, '[DEBUG] socket.io client joined room');
      } else {
        logger.warn({
          socketId: socket.id
        }, '[DEBUG] socket.io userAgent event missing clientId');
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      logger.info({
        socketId: socket.id,
        reason
      }, 'socket.io connection closed');
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error({
        socketId: socket.id,
        error: error.message
      }, 'socket.io connection error');
    });
  });

  logger.info('Socket.IO connection handlers initialized');
}

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
export function broadcast(message: WebSocketMessage): void {
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
 * Find a socket by clientId (room name)
 * @param clientId Optional clientId (room name). If undefined, finds the first available socket connection.
 * @returns Object containing the socket and the clientId used
 * @throws Error if no socket is found
 */
export function findSocketByClientId(clientId?: string): { socket: Socket; clientId: string } {
  if (!io) {
    throw new Error('Socket.IO instance not initialized');
  }

  // Helper function to find clientId from a socket's rooms
  const getClientIdFromSocket = (socket: Socket): string | null => {
    const rooms = Array.from(socket.rooms);
    // Find the room that's not the socket's own ID (which is auto-joined)
    return rooms.find(room => room !== socket.id) || null;
  };

  // Helper function to get the first available socket and its clientId
  const getFirstAvailableSocket = (): { socket: Socket; clientId: string } | null => {
    const sockets = Array.from(io!.sockets.sockets.values());
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
  };

  // If clientId is provided, try to find socket in that room
  if (clientId) {
    const socketsInRoom = io.sockets.adapter.rooms.get(clientId);
    
    if (socketsInRoom && socketsInRoom.size > 0) {
      // Get the first socket ID from the room
      const socketId = Array.from(socketsInRoom)[0];
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          return { socket, clientId };
        }
      }
    }

    // If no socket found in the specified room, fall back to first available socket
    logger.warn({
      clientId,
      availableRooms: Array.from(io.sockets.adapter.rooms.keys())
    }, '[DEBUG] no sockets found in specified room, falling back to first available socket');
  }

  // If clientId is undefined or no socket found in room, find first available socket
  const result = getFirstAvailableSocket();
  if (!result) {
    throw new Error('No active Socket.IO connections available');
  }

  return result;
}

/**
 * Send a message to a specific client and wait for acknowledgement
 * @param message The message to send
 * @param responseEvent Kept for backward compatibility but not used with acknowledgements
 * @param timeoutMs Optional timeout in milliseconds. If undefined, waits indefinitely for acknowledgement
 * @param clientId Optional clientId (room name) to send to
 * @returns Promise that resolves with the acknowledgement data
 */
export async function acknowledge(
  message: WebSocketMessage,
  timeoutMs?: number,
): Promise<any> {
  if (!io) {
    throw new Error('Socket.IO instance not initialized');
  }

  const { socket, clientId } = findSocketByClientId(message.clientId);

  const startTime = performance.now();
  logger.info({
    clientId,
    socketId: socket.id,
    event: message.event,
    timeoutMs: timeoutMs ?? 'none',
    data: message.data
  }, '[DEBUG] socket.io sending message to specific socket with acknowledgement');

  try {
    let response: any;
    
    // Use Socket.IO's emitWithAck Promise API
    if (timeoutMs !== undefined && timeoutMs > 0) {
      // With timeout
      response = await socket.timeout(timeoutMs).emitWithAck(message.event, message.data);
    } else {
      // No timeout - wait indefinitely for acknowledgement
      response = await socket.emitWithAck(message.event, message.data);
    }

    const duration = performance.now() - startTime;
    logger.debug({
      clientId,
      socketId: socket.id,
      event: message.event,
      hasResponse: !!response,
      response: response,
      durationMs: Math.round(duration)
    }, 'socket.io acknowledgement received successfully');

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      clientId,
      socketId: socket.id,
      event: message.event,
      error: errorMessage,
      errorType: typeof error,
      errorDetails: error,
      durationMs: Math.round(duration)
    }, '[DEBUG] socket.io acknowledgement timeout or error');

    throw new Error(`Socket.IO request timed out or failed: ${errorMessage}`);
  }
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
