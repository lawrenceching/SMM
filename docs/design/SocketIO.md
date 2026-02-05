# Socket.io in SMM

The socket.io is used for frontend-backend communication.

## Frontend

### Handling broadcast event

broadcast event is handled in WebSocketHandlers in `ui/src/main.tsx`.
WebSocketHandlers converts event to Native Event System (document.addEventListener, document.dispatchEvent).
The native event name is "socket.io_" + socket.io event name.

#### How to add new event handler in frontend

Use 'ping' event handler as example

1. Create React component `PingEventListener.tsx` in `ui/src/components/eventlisteners/`, the event is `socket.io_ping`. The component call `document.addEventListener` in `useMount` hook, and call `document.removeEventListener` in `useUnmount` hook.

2. Use `PingEventListener` in `AppSwitcher` to active the event listener.

### Handling ackknowledge event

Handle in `WebSocketHandlers` in `ui/src/main.tsx`

