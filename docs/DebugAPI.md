# Debug API

Debug API allow developer to trigger functions from API call.

Some functions will be invoked in AI flow or other high-cost flow.
And debug API allow developer to skip those high-cose flow and test the function easily.

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

Broadcast a WebSocket message to all connected clients. Can be used to test various WebSocket events.

broadcastMessage will NOT wait for the response. It delivers message and return immediately.

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

Note: The `askForConfirmation` event requires a `requestId` in a real scenario (when called from the server tool), but for testing via debug API, you can omit it. The UI will still show the confirmation dialog, but won't be able to send a response back without a proper requestId.



### retrieve

The retrieve function retrives data from UI. It will wait until UI return data.

It's designed for user cases like:
1. Ask user confirmation
2. Ask user input
3. Require UI to display spinner and return after spinner dismiss

```typescript
interface RetrieveDebugApiRequestBody {
    /**
     * Name of function
     */
    name: string,
    event: string,
    /**
     * Optional clientId. If it's provided, debug API send event to websocket connect by clientId. If not provided, debug API send event to the first available websocket connection.
     */
    clientId?: string,
    data?: any
}
```

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