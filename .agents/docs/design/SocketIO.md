# Socket.io in SMM

Socket.IO is used for frontend-backend real-time communication.

## Backend (shared)

Server-side Socket.IO lives in **`packages/core-routes`**:

- `createSocketIOManager(httpServer, config)` — attach to an existing `node:http.Server`
- Connection handshake: `hello` → client `userAgent` + `clientId` → server joins room
- Messaging: `broadcast`, `acknowledge`, `findSocketByClientId`, etc.

**Hosts**:

| Host | Integration |
|------|-------------|
| `apps/cli` | `http.createServer` + Hono (`@hono/node-server`) on main port; Socket.IO on same server |
| `apps/ohos` | Electron main `http.createServer` on `127.0.0.1:18081`; HTTP handler skips `/socket.io/` |

Business event producers (`folderWatcher`, rename/recognize tools, AI agent) remain in `apps/cli` and call `broadcast` / `acknowledge` via the shared manager API.

## Frontend

### Handling broadcast event

Broadcast events are handled in `WebSocketHandlers` in `ui/src/main.tsx`.
`WebSocketHandlers` converts events to the native event system (`document.addEventListener`, `document.dispatchEvent`).
The native event name is `socket.io_` + socket.io event name.

#### How to add new event handler in frontend

Use `ping` as an example:

1. Create React component `PingEventListener.tsx` in `ui/src/components/eventlisteners/`. The event is `socket.io_ping`. The component calls `document.addEventListener` in `useMount` and `document.removeEventListener` in `useUnmount`.

2. Use `PingEventListener` in `AppSwitcher` to activate the listener.

### Handling acknowledge event

Handle in `WebSocketHandlers` in `ui/src/main.tsx`.
