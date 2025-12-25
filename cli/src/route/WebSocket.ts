import type { Context } from 'hono';
import { registerConnection, unregisterConnection, handleWebSocketResponse, registerClientId, type WebSocketMessage } from '../utils/websocketManager';
import pino from 'pino';

const logger = pino();

/**
 * Create WebSocket handler for Hono
 * Sends "hello" event on connection and handles incoming messages
 */
export function createWebSocketHandler() {
  return (c: Context) => {
    return {
      onOpen(event: Event, ws: any) {
        logger.info('websocket connection established');
        
        // Register the connection
        registerConnection(ws);

        // Send "hello" event immediately when connection is established
        const helloMessage: WebSocketMessage = {
          event: 'hello'
        };
        
        try {
          ws.send(JSON.stringify(helloMessage));
          logger.info({
            event: 'hello'
          }, 'websocket message sent');
        } catch (error) {
          logger.error({
            error: error instanceof Error ? error.message : String(error),
            event: 'hello'
          }, 'websocket error sending hello event');
        }
      },
      onMessage(event: MessageEvent, ws: any) {
        try {
          const text = typeof event.data === 'string' ? event.data : event.data.toString();
          const parsed: WebSocketMessage = JSON.parse(text);
          
          // Log received message
          logger.info({
            event: parsed.event,
            requestId: parsed.requestId,
            hasData: !!parsed.data
          }, 'websocket message received');

          // Check if this is a response to a pending request
          if (parsed.requestId) {
            handleWebSocketResponse(parsed);
          }

          // Handle userAgent event
          if (parsed.event === 'userAgent' && parsed.data?.userAgent) {
            logger.info({
              userAgent: parsed.data.userAgent,
              clientId: parsed.data?.clientId
            }, 'websocket received userAgent');
            
            // Register clientId if provided
            if (parsed.data?.clientId) {
              registerClientId(ws, parsed.data.clientId);
              logger.info({
                clientId: parsed.data.clientId
              }, 'websocket registered clientId');
            }
          }

          // Handle selectedMediaMetadata event (response from frontend)
          // if (parsed.event === 'selectedMediaMetadata' && parsed.data?.selectedMediaMetadata) {
          //   logger.info({
          //     event: parsed.event,
          //     data: parsed.data.selectedMediaMetadata
          //   }, 'websocket received selectedMediaMetadata');
          // }
        } catch (error) {
          logger.error({
            error: error instanceof Error ? error.message : String(error)
          }, 'websocket error parsing message');
        }
      },
      onClose(event: CloseEvent, ws: any) {
        // Unregister the connection
        unregisterConnection(ws);
        
        if (event.code !== 1000) {
          // Non-normal closure indicates an error
          logger.error({
            code: event.code,
            reason: event.reason
          }, 'websocket connection closed with error');
        } else {
          logger.info('websocket connection closed');
        }
      },
      onError(event: Event, ws: any) {
        logger.error({
          error: event.type
        }, 'websocket error');
      },
    };
  };
}

