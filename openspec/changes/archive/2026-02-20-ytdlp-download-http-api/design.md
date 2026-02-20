## Context

yt-dlp integration requires a download endpoint to fetch videos. The CLI uses Bun runtime and needs to spawn yt-dlp as a child process. The existing ytdlp-http-api provides discover and version endpoints; this extends it with download capability.

## Goals / Non-Goals

**Goals:**
- Create `POST /api/ytdlp/download` endpoint
- Accept `url` (required), optional `args`, and optional `folder` in request body
- Only allow `--write-thumbnail` and `--embed-thumbnail` as args for security
- Execute yt-dlp with provided arguments and return download status with file path

**Non-Goals:**
- Streaming progress updates (future enhancement)
- Full yt-dlp argument support (restricted to thumbnail args for now)

## Decisions

1. **Args Validation**: Only allow `--write-thumbnail` and `--embed-thumbnail`. Reject any other arguments to prevent security issues.

2. **Output Directory**: Default to `~/Downloads`. Allow optional `folder` parameter in request body to specify custom download location.

3. **Response Format**: Return JSON with status, error, and file path. HTTP 200 for success, HTTP 400 for validation errors.

## Risks / Trade-offs

- **Long-running downloads**: No progress tracking yet - could timeout. Mitigation: increase timeout or add streaming in future.
- **Disk space**: No quota or path validation. User must ensure sufficient disk space.
