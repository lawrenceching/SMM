# yt-dlp API

## GET /api/ytdlp/discover

Discovers the yt-dlp binary executable path.

### Request

No request body required.

### curl Example

```bash
curl -X GET "http://localhost:30000/api/ytdlp/discover"
```

### Response

```json
{
  "path": "C:\\Users\\xxx\\AppData\\Local\\SMM\\bin\\yt-dlp\\yt-dlp.exe"
}
```

Or when not found:

```json
{
  "error": "yt-dlp not found"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `path` | string? | The discovered yt-dlp binary path, or undefined if not found |
| `error` | string? | Error message if discovery failed |

### Discovery Sequence

yt-dlp is discovered in the following order:

1. `ytdlpExecutablePath` in user config (`smm.json`)
2. `bin/yt-dlp/yt-dlp.exe` in project root folder (development mode)
3. `bin/yt-dlp/yt-dlp.exe` in SMM installation path:
   - Windows: `%LOCALAPPDATA%\SMM`
   - macOS: `~/Library/Application Support/SMM`
   - Linux: `~/.local/share/SMM`

## GET /api/ytdlp/version

Gets the yt-dlp version by executing `yt-dlp --version`.

### Request

No request body required.

### curl Example

```bash
curl -X GET "http://localhost:30000/api/ytdlp/version"
```

### Response

On success:

```json
{
  "version": "2023.10.10"
}
```

If yt-dlp executable not found:

```json
{
  "error": "yt-dlp executable not found"
}
```

If command execution failed:

```json
{
  "error": "failed to execute yt-dlp"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string? | The yt-dlp version string |
| `error` | string? | Error message if yt-dlp not found or execution failed |

## POST /api/ytdlp/download

Downloads a video using yt-dlp.

### Request Body

```json
{
  "url": "https://example.com/video",
  "args": ["--write-thumbnail"],
  "folder": "~/Downloads/MyVideos"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Video URL to download |
| `args` | string[] | No | Optional arguments (only `--write-thumbnail` and `--embed-thumbnail` allowed) |
| `folder` | string | No | Download destination folder (defaults to `~/Downloads` if not provided) |

### curl Example

```bash
curl -X POST "http://localhost:30000/api/ytdlp/download" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/video", "args": ["--write-thumbnail"], "folder": "~/Downloads/MyVideos"}'
```

### Response

On success:

```json
{
  "success": true,
  "path": "C:\\Users\\lawrence\\Downloads\\春晚机器人攻陷白宫.mp4"
}
```

If yt-dlp executable not found:

```json
{
  "error": "yt-dlp executable not found"
}
```

If URL is missing:

```json
{
  "error": "url is required"
}
```

If disallowed args provided:

```json
{
  "error": "Only allowed args are: --write-thumbnail, --embed-thumbnail"
}
```

If download fails:

```json
{
  "error": "yt-dlp download failed: <error message>"
}
```
