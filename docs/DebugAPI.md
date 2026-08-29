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

### renameFilesInBatch

The renameFilesInBatch function allows testing the batch file renaming functionality directly. It will:
1. Validate all rename operations
2. Ask for user confirmation (if clientId is provided and UI is connected)
3. Perform the file renames on the filesystem
4. Update media metadata

```typescript
interface RenameFilesInBatchDebugApiRequestBody {
    name: "renameFilesInBatch",
    folderPath: string,
    files: Array<{
        from: string,
        to: string
    }>,
    clientId?: string
}
```

#### Example: Rename files in a media folder

```bash
curl -X POST http://localhost:30000/debug \
  -H "Content-Type: application/json" \
  -d '{
    "name": "renameFilesInBatch",
    "folderPath": "/path/to/media/folder",
    "files": [
      {
        "from": "/path/to/media/folder/file1.txt",
        "to": "/path/to/media/folder/file1_renamed.txt"
      },
      {
        "from": "/path/to/media/folder/file2.txt",
        "to": "/path/to/media/folder/file2_renamed.txt"
      }
    ],
    "clientId": "optional-client-id"
  }'
```

**Note:** 
- The `folderPath` must be a folder that is currently opened in SMM (has metadata cache)
- If `clientId` is provided and a UI client is connected, it will show a confirmation dialog
- If `clientId` is not provided or no UI is connected, the confirmation will timeout and the operation will fail
- The function returns validation errors if any rename operations are invalid

### createRenameEpisodePlan

Creates a pending rename-files plan via `Core.createRenameEpisodePlan` (same as the AI/MCP tool **`create-rename-episode-plan`**). Use this in e2e tests to skip the AI chat flow and drive the rename review UI directly.

When `creator` is omitted, the debug route defaults to `"ai"` and broadcasts **`RenameFilesPlanReady`**. The user still confirms in SMM; apply with `POST /api/apply-plan` or CLI `smm apply <planId>`.

```typescript
interface CreateRenameEpisodePlanDebugApiRequestBody {
  mediaFolderPath: string
  files: Array<{ from: string; to: string }>
  creator?: "ai" | "app"
}
```

#### Example: Create an AI rename plan

```bash
curl -X POST http://localhost:30000/debug/createRenameEpisodePlan \
  -H "Content-Type: application/json" \
  -d '{
    "mediaFolderPath": "/path/to/media/folder",
    "files": [
      {
        "from": "/path/to/media/folder/S01E01.mkv",
        "to": "/path/to/media/folder/Show Name - S01E01 - Episode Title.mkv"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "planId": "550e8400-e29b-41d4-a716-446655440000",
    "plan": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "task": "rename-files",
      "status": "pending",
      "files": [
        {
          "from": "/path/to/media/folder/S01E01.mkv",
          "to": "/path/to/media/folder/Show Name - S01E01 - Episode Title.mkv"
        }
      ]
    }
  }
}
```

**Note:**
- `mediaFolderPath` must be a managed TV show folder with metadata cache
- `files` must be non-empty; validation errors return `{ success: false, error: "..." }`
- See [Rename Episodes](./dev/rename-episodes.md) for product flow and [Manage Plan](./dev/manage-plan.md) for apply/reject

### Simulate Rename Plan Ready

Simulate the **`RenameFilesPlanReady`** Socket.IO event after a plan file already exists (e.g. when testing UI without calling `createRenameEpisodePlan`).

```bash
curl -X POST http://localhost:30000/debug \
  -H "Content-Type: application/json" \
  -d '{
    "name": "renameFilesPlanReady",
    "taskId": "8d4b0237-e2d3-4eea-a175-881426bf5e95"
  }'
```


### cleanUp

The cleanUp function allows developers to clean up user configuration and media metadata cache. This is useful for testing, debugging, and resolving configuration issues. It deletes:
1. User config file (located at the path returned by `getUserConfigPath()`)
2. Media metadata cache directory (located at `mediaMetadataDir`)

```typescript
interface CleanUpDebugApiRequestBody {
  name: "cleanUp"
}
```

#### Example: Clean up user data

```bash
curl -X POST http://localhost:30000/debug \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cleanUp"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "configDeleted": true,
    "metadataDeleted": true
  }
}
```

**Note:**
- The function gracefully handles missing files/directories (no error if they don't exist)
- If either operation fails, the function continues with the other operation
- Errors are collected and returned in the response if any occur
- The function returns success if at least one operation completes, even if the other fails

#### Complete Example: Create plan, then apply from CLI

```bash
PLAN_ID=$(curl -s -X POST http://localhost:30000/debug/createRenameEpisodePlan \
  -H "Content-Type: application/json" \
  -d '{
    "mediaFolderPath": "/path/to/media/folder",
    "files": [
      {
        "from": "/path/to/media/folder/S01E01.mkv",
        "to": "/path/to/media/folder/Show Name - S01E01 - Episode Title.mkv"
      }
    ]
  }' | jq -r '.data.planId')

# Review in SMM UI, or apply directly:
smm apply "$PLAN_ID"
```