# Debug API

Debug API allow developer to trigger functions from API call.

Some functions will be invoked in AI flow or other high-cost flow.
And debug API allow developer to skip those high-cost flow and test the function easily.

## Architecture

The Debug API now uses **Socket.IO** for real-time communication between server and client:
- **Event emitters** for broadcasting messages to all clients
- **Acknowledgements** for request/response patterns (replacing manual requestId tracking)
- **Rooms** for multi-client management (using clientId as room name)

## `POST /debug`

```typescript
interface DebugApiRequestBody {
    /**
     * Name of function
     */
    name: string
}
```



## Supported Functions

### broadcastMessage

Broadcast a Socket.IO message to all connected clients. Can be used to test various Socket.IO events.

broadcastMessage will NOT wait for the response. It delivers message and returns immediately using Socket.IO's `emit()` method.

#### Example: mediaMetadataUpdated event

```bash
curl -X POST http://localhost:30000/debug \
  -H "Content-Type: application/json" \
  -d '{
    "name": "broadcastMessage",
    "event": "mediaMetadataUpdated",
    "data": {
      "folderPath": "/home/lawrence/medias/古见同学有交流障碍症"
    }
  }'
```

#### Example: askForConfirmation event

```bash
curl -X POST http://localhost:30000/debug \
  -H "Content-Type: application/json" \
  -d '{
    "name": "broadcastMessage",
    "event": "askForConfirmation",
    "data": {
      "message": "Do you want to proceed with this action?"
    }
  }'
```

Note: With Socket.IO, the `askForConfirmation` event no longer requires manual `requestId` management. Socket.IO handles request/response correlation automatically through acknowledgement callbacks. When testing via broadcastMessage, the UI will show the dialog but won't have a callback to send the response back. Use the `retrieve` function instead for proper request/response testing.



### retrieve

The retrieve function retrieves data from UI using Socket.IO acknowledgements. It will wait until UI returns data via the acknowledgement callback.

It's designed for use cases like:
1. Ask user confirmation
2. Ask user input
3. Require UI to display spinner and return after spinner dismiss

With Socket.IO, the response is handled automatically through acknowledgement callbacks, eliminating the need for manual `responseEvent` tracking.

```typescript
interface RetrieveDebugApiRequestBody {
    /**
     * Name of function
     */
    name: string,
    event: string,
    /**
     * Optional clientId (room name). If provided, debug API sends event to the Socket.IO room with this clientId. 
     * If not provided, debug API sends event to the first available connection.
     */
    clientId?: string,
    data?: any
}
```

#### How Socket.IO Acknowledgements Work

1. Server sends event to client with data and a callback function
2. Client receives event, processes it, and calls the callback with response data
3. Server's Promise resolves with the response data from the callback
4. No manual requestId or responseEvent management needed!

#### Ask User Confirmation

```bash
curl -X POST http://localhost:30000/debug \
  -H "Content-Type: application/json" \
  -d '{
    "name": "retrieve",
    "event": "askForConfirmation",
    "data": {
      "title": "Confirmation",
      "body": "Confirm to refresh?"
    }
  }'
```