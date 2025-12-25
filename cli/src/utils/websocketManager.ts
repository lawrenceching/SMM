import pino from "pino"
const logger = pino()

export interface WebSocketMessage {
  event: string;
  data?: any;
  requestId?: string; // For request/response correlation
}

type WebSocketConnection = {
  send: (data: string) => void;
  readyState: number;
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  responseEvent: string; // The event name we're waiting for
};

// Store active WebSocket connections
const connections = new Set<WebSocketConnection>();

// Store mapping from clientId to WebSocket connection
const clientIdToConnection = new Map<string, WebSocketConnection>();

// Store mapping from WebSocket connection to clientId (for cleanup)
const connectionToClientId = new Map<WebSocketConnection, string>();

// Store pending requests waiting for responses
const pendingRequests = new Map<string, PendingRequest>();

// Default timeout for requests (5 seconds)
const DEFAULT_TIMEOUT = 5000;

/**
 * Register a WebSocket connection
 */
export function registerConnection(ws: WebSocketConnection): void {
  connections.add(ws);
  console.log(`[WebSocketManager] Connection registered. Total connections: ${connections.size}`);
}

/**
 * Unregister a WebSocket connection
 */
export function unregisterConnection(ws: WebSocketConnection): void {
  connections.delete(ws);
  
  // Remove clientId mapping if it exists
  const clientId = connectionToClientId.get(ws);
  if (clientId) {
    clientIdToConnection.delete(clientId);
    connectionToClientId.delete(ws);
    console.log(`[WebSocketManager] Removed clientId mapping: ${clientId}`);
  }
  
  console.log(`[WebSocketManager] Connection unregistered. Total connections: ${connections.size}`);
}

/**
 * Register a clientId for a WebSocket connection
 */
export function registerClientId(ws: WebSocketConnection, clientId: string): void {
  // Remove old mapping if this connection was already mapped
  const oldClientId = connectionToClientId.get(ws);
  if (oldClientId && oldClientId !== clientId) {
    clientIdToConnection.delete(oldClientId);
  }
  
  clientIdToConnection.set(clientId, ws);
  connectionToClientId.set(ws, clientId);
  console.log(`[WebSocketManager] Registered clientId: ${clientId}`);
}

/**
 * Get WebSocket connection by clientId
 */
export function getConnectionByClientId(clientId: string): WebSocketConnection | null {
  const ws = clientIdToConnection.get(clientId);
  if (ws && ws.readyState === 1) { // WebSocket.OPEN === 1
    return ws;
  }
  // Clean up stale connection if found
  if (ws) {
    clientIdToConnection.delete(clientId);
    connectionToClientId.delete(ws);
  }
  return null;
}

/**
 * Send a message to all connected clients
 */
export function broadcastMessage(message: WebSocketMessage): void {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  
  logger.info({
    event: message.event,
    requestId: message.requestId,
    type: 'broadcast'
  }, 'websocket message sent (broadcast)');
  
  for (const ws of connections) {
    if (ws.readyState === 1) { // WebSocket.OPEN === 1
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          event: message.event,
          requestId: message.requestId
        }, 'websocket error sending message');
      }
    }
  }
  
  if (sentCount === 0 && connections.size > 0) {
    logger.warn({
      connections: connections.size
    }, 'websocket no active connections to send message to');
  } else {
    logger.info({
      sentCount,
      totalConnections: connections.size,
      event: message.event
    }, 'websocket message sent to connections');
  }
}

/**
 * Send a message and wait for a response
 * @param message The WebSocket message to send
 * @param responseEvent The event name to wait for in the response
 * @param timeoutMs Timeout in milliseconds (default: 5000)
 * @param clientId Optional clientId to send to a specific connection
 * @returns Promise that resolves with the response data
 */
export function sendAndWaitForResponse(
  message: WebSocketMessage,
  responseEvent: string,
  timeoutMs: number = DEFAULT_TIMEOUT,
  clientId?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Generate unique request ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Add requestId to message
    const messageWithId: WebSocketMessage = {
      ...message,
      requestId,
    };

    // Set up timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`WebSocket request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Store pending request
    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout,
      responseEvent,
    });

    // Send message to specific connection if clientId is provided
    if (clientId) {
      const ws = getConnectionByClientId(clientId);
      if (!ws) {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        reject(new Error(`No active WebSocket connection found for clientId: ${clientId}`));
        return;
      }
      
      try {
        ws.send(JSON.stringify(messageWithId));
        logger.info({
          requestId,
          clientId,
          event: message.event,
          responseEvent,
          timeoutMs
        }, 'websocket message sent');
      } catch (error) {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        logger.error({
          requestId,
          clientId,
          error: error instanceof Error ? error.message : String(error)
        }, 'websocket error sending message');
        reject(error instanceof Error ? error : new Error('Failed to send WebSocket message'));
      }
      return;
    }

    // Fallback: use the first active connection if clientId is not provided
    const firstConnection = getFirstActiveConnection();
    if (!firstConnection) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      reject(new Error('No active WebSocket connections available'));
      return;
    }

    // Send message to first active connection
    try {
      firstConnection.send(JSON.stringify(messageWithId));
      logger.info({
        requestId,
        event: message.event,
        responseEvent,
        timeoutMs,
        type: 'first-active-connection'
      }, 'websocket message sent');
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      logger.error({
        requestId,
        error: error instanceof Error ? error.message : String(error)
      }, 'websocket error sending message');
      reject(error instanceof Error ? error : new Error('Failed to send WebSocket message'));
    }
  });
}

/**
 * Handle incoming WebSocket message and resolve pending requests
 * @param message The incoming WebSocket message
 */
export function handleWebSocketResponse(message: WebSocketMessage): void {
  if (!message.requestId) {
    // Not a response to a pending request, ignore
    return;
  }

  const pendingRequest = pendingRequests.get(message.requestId);
  if (!pendingRequest) {
    logger.warn({
      requestId: message.requestId,
      event: message.event
    }, 'websocket received response for unknown request');
    return;
  }

  // Verify the response event matches what we're waiting for
  if (message.event !== pendingRequest.responseEvent) {
    logger.warn({
      requestId: message.requestId,
      expectedEvent: pendingRequest.responseEvent,
      receivedEvent: message.event
    }, 'websocket response event mismatch');
    // Still resolve it, as requestId matching is the primary mechanism
  }

  // Clear timeout and remove from pending requests
  clearTimeout(pendingRequest.timeout);
  pendingRequests.delete(message.requestId);

  // Resolve the promise with the message data
  logger.info({
    requestId: message.requestId,
    event: message.event,
    hasData: !!message.data
  }, 'websocket response received');
  pendingRequest.resolve(message.data);
}

/**
 * Get the first active connection (for single-client scenarios)
 */
export function getFirstActiveConnection(): WebSocketConnection | null {
  for (const ws of connections) {
    if (ws.readyState === 1) { // WebSocket.OPEN === 1
      return ws;
    }
  }
  return null;
}

