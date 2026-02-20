## Context

yt-dlp integration requires HTTP APIs to discover the binary location and verify functionality. The CLI application runs with Bun runtime and uses Hono framework for HTTP endpoints.

## Goals / Non-Goals

**Goals:**
- Create `GET /api/ytdlp/discover` endpoint to find yt-dlp binary
- Create `GET /api/ytdlp/version` endpoint to get yt-dlp version
- Follow existing API design patterns in the codebase

**Non-Goals:**
- Video downloading functionality (future capability)
- yt-dlp configuration management

## Decisions

1. **Path Discovery Strategy**: Check user config first, then project root, then installation path. This follows the existing pattern documented in `apps/cli/docs/Ytdlp.md`.

2. **Response Format**: Return `{ path?: string, error?: string }` at root level (not nested in `data` field) to match the simple API style requested.

3. **Error Handling**: Always return HTTP 200, with business logic errors represented in the `error` field.

## Risks / Trade-offs

- **Path Resolution**: Using `path.resolve(__dirname, "../../../../")` may not work in all build scenarios. Alternative: use environment variable or config to specify project root explicitly.
- **Version Command Timeout**: Added 10 second timeout to prevent hanging. Could be made configurable if needed.
