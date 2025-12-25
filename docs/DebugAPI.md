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