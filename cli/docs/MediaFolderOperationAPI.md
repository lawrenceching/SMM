# Media Folder Operation API

Media Folder Operation API supports renaming files inside opened media folders.

Paths are in **platform-specific format**: POSIX on Linux/macOS, Windows format on Windows.

This API does **not** update media metadata and does **not** emit `mediaMetadataUpdated`. Callers that need metadata updates must perform them separately.

Optional "clientId" HTTP header identifies the client for logging.


## POST /api/renameFiles

Batch-rename files within opened media folders. Each `from` path must be under one of `userConfig.folders` (the media folders open in SMM). Each `to` path must be in the same directory as its `from` (no moving files across folders).

**Request**

```typescript
interface RenameFilesRequestBody {
    /** Batch of file renames. Paths in platform-specific format. */
    files: Array<{ from: string; to: string }>;
    /** Optional trace id for logging/correlation. */
    traceId?: string;
}
```

**Response** (HTTP 200, business errors in `error` field)

```typescript
interface RenameFilesResponseBody {
    data?: {
        succeeded: string[];   // "from" paths that were renamed successfully
        failed: Array<{ path: string; error: string }>;
    };
    error?: string;   // Request-level error (e.g. validation)
}
```

**Validation**

- Every `from` must be under one of the opened media folders (`userConfig.folders`).
- Every `to` must be in the same directory as its `from`.
- Failed items are reported in `data.failed` with `path` and `error`; successful renames are in `data.succeeded`.
