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
  console.log(`[WebSocketManager] Connection unregistered. Total connections: ${connections.size}`);
}

/**
 * Send a message to all connected clients
 */
export function broadcastMessage(message: WebSocketMessage): void {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  
  for (const ws of connections) {
    if (ws.readyState === 1) { // WebSocket.OPEN === 1
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error('[WebSocketManager] Error sending message:', error);
      }
    }
  }
  
  if (sentCount === 0 && connections.size > 0) {
    console.warn('[WebSocketManager] No active connections to send message to');
  } else {
    console.log(`[WebSocketManager] Message sent to ${sentCount} connection(s)`);
  }
}

/**
 * Send a message and wait for a response
 * @param message The WebSocket message to send
 * @param responseEvent The event name to wait for in the response
 * @param timeoutMs Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with the response data
 */
export function sendAndWaitForResponse(
  message: WebSocketMessage,
  responseEvent: string,
  timeoutMs: number = DEFAULT_TIMEOUT
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

    // Check if there are active connections before sending
    const hasActiveConnections = Array.from(connections).some(ws => ws.readyState === 1);
    if (!hasActiveConnections) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      reject(new Error('No active WebSocket connections available'));
      return;
    }

    // Send message
    try {
      broadcastMessage(messageWithId);
      console.log(`[WebSocketManager] Sent request with ID: ${requestId}, waiting for response event: ${responseEvent}`);
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
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
    console.warn(`[WebSocketManager] Received response for unknown request ID: ${message.requestId}`);
    return;
  }

  // Verify the response event matches what we're waiting for
  if (message.event !== pendingRequest.responseEvent) {
    console.warn(`[WebSocketManager] Response event mismatch for request ${message.requestId}. Expected: ${pendingRequest.responseEvent}, got: ${message.event}`);
    // Still resolve it, as requestId matching is the primary mechanism
  }

  // Clear timeout and remove from pending requests
  clearTimeout(pendingRequest.timeout);
  pendingRequests.delete(message.requestId);

  // Resolve the promise with the message data
  console.log(`[WebSocketManager] Resolved request ${message.requestId} with event: ${message.event}`);
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

