# Read Image API

Reads a local image file and returns its base64-encoded contents
as a `data:` URL.

## Endpoint

`POST /api/readImage`

## Request body

```typescript
interface ReadImageRequestBody {
  /**
   * Absolute path of the image file, in platform-specific format.
   * The path must be inside the server-side allowlist.
   */
  path: string;
}
```

## Response body

```typescript
interface ReadImageResponseBody {
  /**
   * Base64-encoded image data in the form:
   *   "data:image/<mime>;base64,<base64-bytes>"
   */
  data?: string;
  error?: string;
}
```

The HTTP status is `200` for both success and validation / allowlist /
I/O failures. `400` is returned only when the request body is not valid
JSON. The UI inspects `error` to decide whether to surface the data URL.

## Error semantics

| Error message | Cause |
|---|---|
| `Validation failed: …` | zod validation failure (missing or empty `path`) |
| `Path "<p>" is not in the allowlist` | The path resolves to a location outside the server-side allowlist |
| `File is not a valid image file. Supported formats: …` | The path extension is not in the supported image list (`.jpg .jpeg .png .gif .webp .svg .bmp .ico .tiff .tif`) |
| `File Not Found: <path>` | The file does not exist |
| `Failed to read image file: <msg>` | Other I/O error during `readFile` |
| `Unexpected error: <msg>` | Outer try/catch |

## Allowlist

The CLI builds its allowlist from `apps/cli/src/utils/buildAllowlist.ts`
(`userDataDir`, `appDataDir`, `tmpDir`, plus configured media folders).
On HarmonyOS, the allowlist is built from `userData`, `temp`, the
user home directory, and the app root (see `apps/ohos/src/http/server.ts`).

## Server

Served by both the Hono Bun server (apps/cli port 30000) and the
core-routes Node `http` server (port from
`HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI,
18081 on HarmonyOS). The Hono shell at
`apps/cli/src/route/ReadImage.ts` delegates to `doReadImage` from
`@smm/core-routes`.

## Source

- `packages/core-routes/src/readImage.ts` — pure `doReadImage`
  function (no Bun APIs; uses `node:fs/promises`).
- `packages/core-routes/src/routes/readImageRoute.ts` — Node `http`
  handler used by ohos.
- `apps/cli/src/route/ReadImage.ts` — Hono shell used by the
  desktop CLI.