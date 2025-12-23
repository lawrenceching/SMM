import type { Context } from 'hono';

export interface WebSocketMessage {
  event: string;
  data?: any;
}

/**
 * Create WebSocket handler for Hono
 * Sends "hello" event on connection and handles incoming messages
 */
export function createWebSocketHandler() {
  return (c: Context) => {
    return {
      onOpen(event: Event, ws: any) {
        console.log('[WebSocket] Connection established');

        // Send "hello" event immediately when connection is established
        const helloMessage: WebSocketMessage = {
          event: 'hello'
        };
        
        try {
          ws.send(JSON.stringify(helloMessage));
          console.log('[WebSocket] Sent hello event');
        } catch (error) {
          console.error('[WebSocket] Error sending hello event:', error);
        }
      },
      onMessage(event: MessageEvent, ws: any) {
        try {
          const text = typeof event.data === 'string' ? event.data : event.data.toString();
          const parsed: WebSocketMessage = JSON.parse(text);
          
          console.log('[WebSocket] Received message:', parsed);

          // Handle userAgent event
          if (parsed.event === 'userAgent' && parsed.data?.userAgent) {
            console.log('[WebSocket] Received userAgent:', parsed.data.userAgent);
            // You can add additional handling here if needed
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      },
      onClose(event: CloseEvent, ws: any) {
        if (event.code !== 1000) {
          // Non-normal closure indicates an error
          console.error(`[WebSocket] Connection closed with error - code: ${event.code}, reason: ${event.reason}`);
        } else {
          console.log('[WebSocket] Connection closed');
        }
      },
      onError(event: Event, ws: any) {
        console.error('[WebSocket] Error:', event);
      },
    };
  };
}

