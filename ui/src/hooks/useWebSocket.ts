import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  event: string;
  data?: any;
}

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketReturn {
  status: WebSocketStatus;
  connect: () => void;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
}

type WebSocketEventListener = (message: WebSocketMessage) => void;

const webSocketEventListeners = new Set<WebSocketEventListener>();
let activeWebSocket: WebSocket | null = null;

export function sendWebSocketMessage(message: WebSocketMessage): void {
  if (activeWebSocket?.readyState === WebSocket.OPEN) {
    try {
      activeWebSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error);
    }
    return;
  }

  console.warn('[WebSocket] Cannot send message: WebSocket is not open');
}

/**
 * Register a WebSocket event handler.
 *
 * The handler receives `(event, data?)`. You can ignore `data` if not needed.
 */
export function useWebSocketEvent(handler: (event: string, data?: any) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener: WebSocketEventListener = (message) => {
      handlerRef.current(message.event, message.data);
    };

    webSocketEventListeners.add(listener);
    return () => {
      webSocketEventListeners.delete(listener);
    };
  }, []);
}

/**
 * React hook that returns a stable send function for the active WebSocket.
 */
export function useWebSocketSend() {
  return useCallback((message: WebSocketMessage) => {
    sendWebSocketMessage(message);
  }, []);
}

function createUUID(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateSmmInstanceUUID(): string {
  const key = 'smmInstanceUUID';
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing.trim().length > 0) {
      return existing;
    }
    const created = createUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    // localStorage may be unavailable in some contexts; still return a stable value for this runtime.
    return createUUID();
  }
}

/**
 * React hook for managing WebSocket connection to CLI server
 * Automatically connects when the hook is used
 * Listens for "hello" event and responds with userAgent
 */
export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const smmInstanceUUIDRef = useRef<string>(getOrCreateSmmInstanceUUID());
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || status === 'connecting') {
      return;
    }

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setStatus('connecting');
      const wsUrl = getWebSocketUrl();
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      activeWebSocket = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Received message:', message);

          // Handle "hello" event
          if (message.event === 'hello') {
            console.log('[WebSocket] Received hello event, sending userAgent');
            
            // Send userAgent response
            const userAgentMessage: WebSocketMessage = {
              event: 'userAgent',
              data: {
                userAgent: navigator.userAgent,
                smmInstanceUUID: smmInstanceUUIDRef.current,
              }
            };
            
            ws.send(JSON.stringify(userAgentMessage));
            console.log('[WebSocket] Sent userAgent:', navigator.userAgent);
          }

          // Fan out all events (including "hello") to subscribers
          for (const listener of webSocketEventListeners) {
            try {
              listener(message);
            } catch (error) {
              console.error('[WebSocket] Error in event listener:', error);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed', event.code, event.reason);
        setStatus('disconnected');
        wsRef.current = null;
        if (activeWebSocket === ws) {
          activeWebSocket = null;
        }

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[WebSocket] Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('[WebSocket] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setStatus('error');
    }
  }, [status, getWebSocketUrl]);

  const disconnect = useCallback(() => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      if (activeWebSocket === wsRef.current) {
        activeWebSocket = null;
      }
      wsRef.current = null;
    }

    setStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        console.log('[WebSocket] Sent message:', message);
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
      }
    } else {
      console.warn('[WebSocket] Cannot send message: WebSocket is not open');
    }
  }, []);

  // Auto-connect when component mounts
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    connect,
    disconnect,
    send,
  };
}

