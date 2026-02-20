# yt-dlp API

## GET /api/ytdlp/discover

Discovers the yt-dlp binary executable path.

### Request

No request body required.

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
