# IsFolderAvailable HTTP API

Checks whether a filesystem path exists, can be read by the CLI server process, and refers to a directory (including a symlink whose target is a directory).

**Implementation**: `apps/cli/src/route/IsFolderAvailable.ts`

**UI client**: `apps/ui/src/api/isFolderAvailable.ts`

---

## `POST /api/isFolderAvailable`

### Request

**Headers**

- `Content-Type: application/json` (required)

**Body**

```typescript
interface IsFolderAvailableRequestBody {
  /**
   * Absolute or resolved folder path as understood by the server (native OS form).
   * Must be a non-empty string.
   */
  path: string;
}
```

Example:

```json
{
  "path": "D:\\Media\\TVShows\\Breaking Bad"
}
```

### Responses

#### `200 OK`

The request was valid JSON and passed validation. The server attempted to `stat` the path.

```typescript
interface IsFolderAvailableResponseBody {
  /**
   * True iff stat succeeds and the entry is a directory (after symlink resolution).
   */
  available: boolean;
}
```

Examples:

```json
{ "available": true }
```

```json
{ "available": false }
```

`available` is **false** when the path does not exist, is not a directory (e.g. it is a file), cannot be accessed (permission / IO error / unreachable drive), or any error occurs during `stat`.

#### `400 Bad Request`

Invalid JSON or validation failure.

**Invalid JSON**

```json
{
  "error": "Invalid JSON body"
}
```

**Validation failed** (e.g. missing or empty `path`)

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "path",
      "message": "path is required"
    }
  ]
}
```

---

## Semantics

1. The server uses Node.js `fs.stat` (promise API). Symlinks to directories count as available directories.
2. There is **no** path allowlist for this endpoint beyond normal OS access rules; the CLI runs locally with the same privileges as the desktop app.
3. Successful HTTP responses always use status **200** when the body could be parsed and validated; unavailable folders return **`available: false`**, not an HTTP error code.

---

## Example sequence

```http
POST /api/isFolderAvailable HTTP/1.1
Content-Type: application/json

{"path":"C:\\Temp\\missing-folder"}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"available":false}
```
