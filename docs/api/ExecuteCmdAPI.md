# Execute Command API Documentation

## Overview

The `/api/executeCmd` endpoint provides a secure, streaming command execution interface that allows clients to execute whitelisted command-line tools (`ffmpeg`, `ffprobe`, `yt-dlp`, `videocaptioner`) via HTTP POST requests. It streams real-time output using NDJSON (Newline-Delimited JSON) format.

## Technical Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Web Framework | Hono |
| Request Validation | Zod |
| Process Management | `child_process.spawn` |
| Streaming | `ReadableStream` + NDJSON |

## API Endpoint

### Execute Command

```
POST /api/executeCmd
```

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `X-Timeout` | No | Maximum execution time in milliseconds (default: 300000ms = 5 minutes) |

#### Request Body

```json
{
  "command": "ffmpeg" | "ffprobe" | "yt-dlp" | "videocaptioner",
  "args": ["-i", "input.mp4", "-c:v", "libx264", "output.mp4"]
}
```

##### Request Schema

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `command` | string | Yes | Must be one of: `ffmpeg`, `ffprobe`, `yt-dlp`, `videocaptioner` |
| `args` | string[] | No | Max 100 items, each max 2000 characters, no whitespace characters (`\n`, `\r`, `\t`, `\v`, `\f`, `\0`) |

##### Request Example

```json
{
  "command": "ffmpeg",
  "args": ["-i", "input.mp4", "-ss", "00:00:10", "-vframes", "1", "thumbnail.jpg"]
}
```

#### Response

##### Success (200 OK)

Returns a streaming response with NDJSON format. Each line is a valid JSON object.

**Response Headers:**

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/x-ndjson` |
| `X-Command-Execution-Id` | Full UUID for this command run (correlates with on-disk logs). |
| `X-Command-Log-Path` | Path relative to the app log root: `commands/<uuid>/main.log` (POSIX-style segments). |

Example:

```
Content-Type: application/x-ndjson
X-Command-Execution-Id: 550e8400-e29b-41d4-a716-446655440000
X-Command-Log-Path: commands/550e8400-e29b-41d4-a716-446655440000/main.log
```

##### Server-side command logs

For each successful stream setup, the CLI writes the child process **stdout** and **stderr** (in receive order) to a UTF-8 file under the same log root used for `smm.log` (see `getLogDir()` in `apps/cli/src/utils/config.ts`, overridable with `LOG_DIR`):

```text
<getLogDir>/commands/<X-Command-Execution-Id>/main.log
```

Each chunk is preceded by a line such as `--- stream=stdout ts=<ISO8601> ---` or `--- stream=stderr ts=... ---`. System notes (spawn line, exit, timeout, client abort) use `--- system ts=... ---`. Internal callers that use `runWhitelistedCommandSync` (same whitelist and spawn rules, no HTTP stream) get the same on-disk layout and a new UUID per invocation.

**Message Types:**

###### stdout Message
Standard output from the executed command.

```json
{
  "type": "stdout",
  "data": "frame=  100 fps= 30 q=28.0 size=    1024kB time=00:00:03.33 bitrate=2518.4kbits/s speed=1x"
}
```

###### stderr Message
Standard error output from the executed command.

```json
{
  "type": "stderr",
  "data": "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':"
}
```

###### system Message
System-level events (exit, error, timeout).

**Exit Event:**
```json
{
  "type": "system",
  "data": {
    "event": "exit",
    "code": 0,
    "signal": null
  }
}
```

**Error Event:**
```json
{
  "type": "system",
  "data": {
    "event": "error",
    "message": "spawn ENOENT"
  }
}
```

**Timeout Event:**
```json
{
  "type": "system",
  "data": {
    "event": "timeout"
  }
}
```

##### Client Error (4xx)

```json
{
  "error": "command must be one of: ffmpeg, ffprobe, yt-dlp, videocaptioner"
}
```

| Status Code | Description |
|-------------|-------------|
| 400 | Validation error (invalid command, malformed args, etc.) |
| 404 | Executable not found |
| 500 | Internal server error |

## Streaming Format

### NDJSON Protocol

The response uses Newline-Delimited JSON (NDJSON) format. Each JSON object is on a separate line:

```
{"type":"stdout","data":"frame=0 fps=0 q=0.0 size=N/A time=00:00:00.00 bitrate=N/A speed= 0x"}
{"type":"stderr","data":"Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':"}
{"type":"system","data":{"event":"exit","code":0,"signal":null}}
```

### Client-Side Stream Handling

#### Browser/Fetch API

```typescript
async function executeCommand(command: string, args: string[]) {
  const response = await fetch('/api/executeCmd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, args }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      handleMessage(message);
    }
  }
}
```

#### AbortController for Cancellation

```typescript
const abortController = new AbortController();

fetch('/api/executeCmd', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: 'ffmpeg', args: ['-version'] }),
  signal: abortController.signal,
});

// Cancel execution
abortController.abort();
```

## Security Features

### Command Whitelist

Only the following commands are allowed:
- `ffmpeg` - Video processing
- `ffprobe` - Media metadata inspection
- `yt-dlp` - Video downloading
- `videocaptioner` - Video transcription

### Parameter Validation

1. **Argument Count**: Maximum 100 arguments
2. **Argument Length**: Each argument maximum 2000 characters
3. **Character Restrictions**: No control characters (newline, tab, null, etc.)
4. **No Shell Execution**: Commands are spawned directly without shell, preventing injection attacks

### Timeout Protection

- Default timeout: 5 minutes (300000ms)
- Configurable via `X-Timeout` header
- On timeout: Sends `{"type":"system","data":{"event":"timeout"}}` and kills process

### Client Disconnection

When the client disconnects:
- The server immediately terminates the child process
- Resources are cleaned up
- No zombie processes left behind

## Error Handling Matrix

| Scenario | Response |
|----------|----------|
| Invalid command | `400 Bad Request` with error message |
| Malformed args | `400 Bad Request` with error message |
| Command not found | Stream: `{"type":"system","data":{"event":"error","message":"..."}}` |
| Non-zero exit code | Stream: `{"type":"system","data":{"event":"exit","code":1}}` |
| Client disconnects | Process killed, stream closed |
| Timeout | Stream: `{"type":"system","data":{"event":"timeout"}}` |

## Implementation Details

### Backend Architecture

```
Client                    Hono Router              Child Process
  |                          |                           |
  |--POST /executeCmd------->|                           |
  |                          |-- validate cmd & args      |
  |                          |-- spawn(command, args) --->|
  |                          |                           |-- stdout data
  |                          |<-- stdout chunk -----------|
  |<--NDJSON stdout---------|                           |
  |                          |<-- stderr chunk -----------|
  |<--NDJSON stderr---------|                           |
  |                          |                           |-- process close
  |                          |<-- close event ------------|
  |<--NDJSON exit code------|                           |
  |                          |-- close stream             |
  |  (finish)               |                           |
```

### Client Disconnect Flow

```
Client                    Hono Router              Child Process
  |                          |                           |
  |--POST------------------>|                           |
  |--X (disconnect)         |                           |
  |                          |-- detect abort signal      |
  |                          |-- kill(SIGTERM) ---------->|
  | (aborted)                |-- close controller         |
```

## Usage Examples

### Example 1: Check ffmpeg Version

**Request:**
```json
{
  "command": "ffmpeg",
  "args": ["-version"]
}
```

**Expected Output:**
```json
{"type":"stdout","data":"ffmpeg version 7.0.2-0ubuntu1~24.04.1"}
{"type":"stdout","data":"built with gcc 13 (Ubuntu 13.2.0-23ubuntu4)"}
{"type":"system","data":{"event":"exit","code":0,"signal":null}}
```

### Example 2: Video Transcoding

**Request:**
```json
{
  "command": "ffmpeg",
  "args": ["-i", "input.mp4", "-c:v", "libx264", "-crf", "23", "output.mp4"]
}
```

**Expected Output:**
```json
{"type":"stderr","data":"Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':"}
{"type":"stderr","data":"  Metadata:"}
{"type":"stderr","data":"    major_brand     : isom"}
{"type":"stdout","data":"frame=  100 fps= 30 q=28.0 size=    1024kB time=00:00:03.33"}
{"type":"stdout","data":"frame=  200 fps= 30 q=28.0 size=    2048kB time=00:00:06.67"}
{"type":"system","data":{"event":"exit","code":0,"signal":null}}
```

### Example 3: Download Video with yt-dlp

**Request:**
```json
{
  "command": "yt-dlp",
  "args": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "-o", "%(title)s.%(ext)s"]
}
```

**Expected Output:**
```json
{"type":"stderr","data":"[youtube] Extracting URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
{"type":"stderr","data":"[download] Destination: Never Gonna Give You Up.webm"}
{"type":"stderr","data":"[download]  50.0% of  120.86MiB at  401.60KiB/s ETA 05:08"}
{"type":"stderr","data":"[download] 100% of  120.86MiB in 00:15:23"}
{"type":"system","data":{"event":"exit","code":0,"signal":null}}
```

### Example 4: Set Custom Timeout

**Request with Headers:**
```
POST /api/executeCmd
Content-Type: application/json
X-Timeout: 60000

{
  "command": "ffmpeg",
  "args": ["-i", "input.mp4", "-t", "60", "output.mp4"]
}
```

## TypeScript Types

### Request Types

```typescript
type ExecuteCmdType = 'ffmpeg' | 'ffprobe' | 'yt-dlp' | 'videocaptioner'

interface ExecuteCmdRequest {
  command: ExecuteCmdType;
  args: string[];
}
```

### Response Types

```typescript
interface ExecuteCmdStdoutStderrMessage {
  type: 'stdout' | 'stderr';
  data: string;
}

interface ExecuteCmdSystemMessage {
  type: 'system';
  data: {
    event: 'exit' | 'error' | 'timeout';
    code?: number | null;
    signal?: string | null;
    message?: string;
  };
}

type ExecuteCmdMessage = ExecuteCmdStdoutStderrMessage | ExecuteCmdSystemMessage;
```

### Stream Callbacks

```typescript
interface ExecuteCmdStreamCallbacks {
  onMessage: (message: ExecuteCmdMessage) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}
```

## Best Practices

### For Clients

1. **Buffer Handling**: Always buffer partial lines when parsing NDJSON streams
2. **Error Recovery**: Handle both `error` events and `onError` callbacks
3. **Cancellation**: Use `AbortController` to cancel ongoing requests
4. **Backpressure**: Process stream data promptly to avoid memory buildup

### For Server

1. **Resource Limits**: Monitor concurrent command executions
2. **Process Tracking**: Log command executions for debugging
3. **Graceful Shutdown**: Ensure all child processes are killed on server restart

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `command executable not found` | Install the required command (ffmpeg, yt-dlp, etc.) |
| `spawn ENOENT` | Check if command is installed and accessible in PATH |
| `timeout` | Increase `X-Timeout` value or optimize command |
| Empty output | Check stderr for error messages |

### Debug Mode

Add logging by setting environment variables to enable verbose logging on the server side.
