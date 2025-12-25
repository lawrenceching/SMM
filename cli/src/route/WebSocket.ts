import type { Server as SocketIOServer, Socket } from 'socket.io';
import { setSocketIOInstance, type WebSocketMessage } from '../utils/websocketManager';
import pino from 'pino';

const logger = pino();

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
