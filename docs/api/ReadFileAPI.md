# ReadFile HTTP API

Reads a UTF-8 text file from disk, optionally validating that the path
is inside the configured allowlist (`userDataDir`, `appDataDir`,
`tmpDir`, and any media folder from `userConfig.folders`).

**Implementation**:
- `packages/core-routes/src/readFile.ts` — pure function (`doReadFile`,
 `checkFileIsReadable`).
- `packages/core-routes/src/routes/readFileRoute.ts` — Node `http`
 handler (`handleReadFilePost`).

The route is served both by:
- The Hono Bun server on `apps/cli` port `30000` (via the thin Hono
 adapter in `apps/cli/src/route/ReadFile.ts`), and
- The core-routes Node `http` server (port from
 `HelloResponseBody.coreRoutesPort`, default `3001` on the desktop
 CLI, `18081` on the HarmonyOS Electron main process).

**UI client**: `apps/ui/src/api/readFile.ts`

---

## `POST /api/readFile`

### Request

**Headers**

- `Content-Type: application/json` (required)

**Body**

```typescript
interface ReadFileRequestBody {
 /**
 * Absolute path of file, it could be POSIX path or Windows path
 */
 path: string;
 /**
 * Default is true. When false, allowlist validation is skipped.
 * Used by the UI to read NFO files for episodes outside the
 * configured media folders (see TvShowPanelUtils.ts).
 */
 requireValidPath?: boolean;
}
```

Example:

```json
{
 "path": "C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json"
}
```

### Responses

#### `200 OK`

The request was valid JSON. The server attempted to read the file.

```typescript
interface ReadFileResponseBody {
 /**
 * The UTF-8 decoded file contents, present on success.
 */
 data?: string;
 /**
 * Error message on failure (validation, allowlist, file not found, etc.).
 * The data field is absent in this case.
 */
 error?: string;
}
```

Examples:

```json
{ "data": "{\"applicationLanguage\":\"zh-CN\"}" }
```

```json
{ "error": "File Not Found: C:\\missing.txt" }
```

**Error variants** (all return HTTP `200` with `{ error }`):

- `Validation failed: <details>` — zod validation failure (empty
 `path`, missing field, wrong type).
- `Path "<path>" is not in the allowlist` — allowlist rejection
 (only when `requireValidPath` is `undefined` or `true`).
- `File Not Found: <path>` — the file does not exist (or the
 platform access probe failed). Uses the
 `fileNotFoundError(path)` helper from `@smm/core/errors`.
- `Failed to read file: <msg>` — other I/O error.
- `Unexpected error: <msg>` — outer try/catch.

#### `400 Bad Request`

Invalid JSON body.

```json
{
 "error": "Invalid JSON body",
 "details": "Unexpected token x in JSON at position0"
}
```

#### `500 Internal Server Error`

Hono adapter catch-all (only on the Hono server path):

```json
{
 "error": "Failed to process read file request",
 "details": "<message>"
}
```

The core-routes Node `http` handler returns `400` for invalid JSON
rather than `500`, so the same `POST` produces the same response
shape regardless of which server handled it.

---

## Semantics

1. The server uses Node.js `fs.access` + `fs.readFile` (promise API).
 Symlinks to files are followed by `fs.readFile` (Node's default).
2. The path is resolved to POSIX format (`Path.posix`) and then
 checked against the allowlist. The platform-specific form is
 used for the actual `fs.readFile` call.
3. When `requireValidPath` is `false`, the allowlist check is
 skipped entirely. This is the UI's escape hatch for reading NFO
 files for episodes outside the configured media folders.
4. The response is always JSON, regardless of whether the file is
 binary or text. Reading a binary file will return the raw bytes
 as a UTF-8 string (lossy), so callers should only use this
 endpoint for known-text files (JSON, NFO, SRT, etc.).

---

## Example sequence

```http
POST /api/readFile HTTP/1.1
Content-Type: application/json

{"path":"C:\\Temp\\missing.txt"}
```

```http
HTTP/1.1200 OK
Content-Type: application/json

{"error":"File Not Found: C:\\Temp\\missing.txt"}
```
