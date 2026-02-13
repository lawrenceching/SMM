import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  event: string;
  data?: any;
  requestId?: string; // For backward compatibility
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
let activeSocket: Socket | null = null;

export function sendWebSocketMessage(message: WebSocketMessage): void {
  if (activeSocket?.connected) {
    try {
      activeSocket.emit(message.event, message.data);
    } catch (error) {
      console.error('[Socket.IO] Error sending message:', error);
    }
    return;
  }

  console.warn('[Socket.IO] Cannot send message: Socket is not connected');
}

/**
 * Register a Socket.IO event handler.
 *
 * The handler receives the full message object, including event and data.
 */
export function useWebSocketEvent(handler: (message: WebSocketMessage) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener: WebSocketEventListener = (message) => {
      handlerRef.current(message);
    };

    webSocketEventListeners.add(listener);
    return () => {
      webSocketEventListeners.delete(listener);
    };
  }, []);
}

/**
 * React hook that returns a stable send function for the active Socket.IO connection.
 */
export function useWebSocketSend() {
  return useCallback((message: WebSocketMessage) => {
    sendWebSocketMessage(message);
  }, []);
}

/**
 * Helper to send acknowledgement for Socket.IO events
 * This should be called by event handlers that receive events with acknowledgements
 */
export function sendAcknowledgement(message: WebSocketMessage, response: any): void {
  console.log('[Socket.IO][DEBUG] sendAcknowledgement called', {
    event: message.event,
    response,
    hasCallback: !!(message as any)._socketCallback,
    callbackType: typeof (message as any)._socketCallback
  });
  
  const callback = (message as any)._socketCallback;
  if (callback && typeof callback === 'function') {
    try {
      console.log('[Socket.IO][DEBUG] Calling callback with response:', response);
      callback(response);
      console.log('[Socket.IO][DEBUG] Acknowledgement sent successfully:', response);
    } catch (error) {
      console.error('[Socket.IO][DEBUG] Error sending acknowledgement:', error);
    }
  } else {
    console.warn('[Socket.IO][DEBUG] No callback available for acknowledgement. Message:', message);
  }
}

function createUUID(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateClientId(): string {
  const key = 'clientId';
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
 * React hook for managing Socket.IO connection to CLI server
 * Automatically connects when the hook is used
 * Listens for "hello" event and responds with userAgent
 */
export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const clientIdRef = useRef<string>(getOrCreateClientId());

  const getSocketUrl = useCallback(() => {
    // Socket.IO uses HTTP/HTTPS protocol, not WS/WSS
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}`;
  }, []);

  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (socketRef.current?.connected || status === 'connecting') {
      return;
    }

    try {
      setStatus('connecting');
      const socketUrl = getSocketUrl();
      console.log('[Socket.IO] Connecting to:', socketUrl);
      
      // Create Socket.IO connection
      const socket = io(socketUrl, {
        // Socket.IO will automatically reconnect
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
        path: '/socket.io/', // Explicit path
        autoConnect: true,
      });
      
      socketRef.current = socket;
      activeSocket = socket;

      // Connection established
      socket.on('connect', () => {
        console.log('[Socket.IO] Connected');
        setStatus('connected');
      });

      // Handle "hello" event from server
      socket.on('hello', () => {
        console.log('[Socket.IO] Received hello event, sending userAgent');
        
        // Send userAgent with clientId
        socket.emit('userAgent', {
          userAgent: navigator.userAgent,
          clientId: clientIdRef.current,
        });
        
        console.log('[Socket.IO] Sent userAgent:', navigator.userAgent);
      });

      // Set up catch-all event listener for custom events
      // This allows us to fan out events to all registered listeners
      // Use onAny to catch all events
      socket.onAny((event: string, ...args: any[]) => {
        console.log('[Socket.IO][DEBUG] Received event:', event, 'args count:', args.length, 'args:', args);
        
        // Skip internal Socket.IO events
        if (event === 'connect' || event === 'disconnect' || event === 'connect_error' || event === 'hello' || event === 'userAgent') {
          return;
        }

        // Check if the last argument is a callback function (acknowledgement)
        const lastArg = args[args.length - 1];
        const hasCallback = typeof lastArg === 'function';
        const callback = hasCallback ? lastArg : undefined;
        const data = hasCallback ? args[0] : args[0];

        console.log('[Socket.IO][DEBUG] Event details:', {
          event,
          hasCallback,
          callbackType: typeof callback,
          dataLength: args.length,
          data
        });

        const message: WebSocketMessage = {
          event,
          data,
        };

        // If there's a callback, we need to handle acknowledgements
        // Store the callback so event handlers can use it
        if (callback) {
          // Add callback to message for acknowledgement handling
          (message as any)._socketCallback = callback;
          console.log('[Socket.IO][DEBUG] Callback attached to message for event:', event);
        }

        // Fan out to all registered listeners
        for (const listener of webSocketEventListeners) {
          try {
            listener(message);
          } catch (error) {
            console.error('[Socket.IO] Error in event listener:', error);
          }
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        console.log('[Socket.IO] Disconnected:', reason);
        setStatus('disconnected');
      });

      // Handle connection errors
      socket.on('connect_error', (error: Error) => {
        console.error('[Socket.IO] Connection error:', error);
        setStatus('error');
      });

    } catch (error) {
      console.error('[Socket.IO] Failed to create connection:', error);
      setStatus('error');
    }
  }, [status, getSocketUrl]);

  const disconnect = useCallback(() => {
    // Close Socket.IO connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      if (activeSocket === socketRef.current) {
        activeSocket = null;
      }
      socketRef.current = null;
    }

    setStatus('disconnected');
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.connected) {
      try {
        socketRef.current.emit(message.event, message.data);
        console.log('[Socket.IO] Sent message:', message);
      } catch (error) {
        console.error('[Socket.IO] Error sending message:', error);
      }
    } else {
      console.warn('[Socket.IO] Cannot send message: Socket is not connected');
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
