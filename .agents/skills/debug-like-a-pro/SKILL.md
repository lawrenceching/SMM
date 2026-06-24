---
name: wlap:debug
version: "0.0.1"
description: Debug complex issues like a professional developer
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
  - AskQuestion
---

# Debug like a Pro

## Step 1: Before ANYTHING

1. **Understanding Context** - read the context file in `.agents/docs/design/[change-name]/context.md`

## Step 2 Quick Path: Analyze the Codebase

Analyze the codebase and find out the root cause.

If root cause was located, go to step 4.
If root cause was NOT located, go to step 3.


## Step 3 Slow Path: Guess-Reproduce-Verify Loop

1. **Possible Reasons** List possible reasons that may cause this issues.
2. **Start Log Server** Start the log server by running Node.js script in `scripts/log-server.ts`
3. **Create Log Session** Create new log session in log server.
4. **Diagnostic Instrumentation** Add temporary debug log using log server.
   Add log by calling log server API
   ```
   fetch(`http://localhost:28080/log`, {...})
   ```
5. **Reproduce** Ask user to reproduce the issue, collect logs for analyze.
6.  **Verify** Analyze the log and identify the reasons
    If log is insufficient, go back to step 7 and try again.
    If all reasons were rejected, go back to step 6 and try again.

   This loop could go several times until we fully locate the root cause.
   **IMPORT** The root cause can ONLY be confirmed with solid log evidence.
7. **Clean Up** 
   - Stop log server (`GET /shutdown`). Log files are deleted automatically when the server shuts down — read them from **path** before shutdown.
   - Remove diagnostic log


## Step 4 Fix

Brief the root cause and propose a fix.
Draw a diagram or mermaid graph if root cause is complicated to describe.
Ask user to type "approved" for explict approval.
Apply the fix ONLY with the user approval.

**IMPORTANT** The proposal needs to cover the product code fix and test needs to supplement.

## Log server

The log server is a small HTTP server that collects focused debug logs during steps 7–8 (reproduce / verify). It is a **supplement**, not a replacement for the project's own logging.

Use it to capture only the lines needed to confirm or reject hypotheses from step 6, without wading through noisy console or application log files.

Script: `scripts/log-server.ts` (Node.js built-ins only; runs on Node, Bun, or Deno).

### Start the server

```bash
# Bun (recommended in this monorepo)
bun scripts/log-server.ts

# Node 22+
node --experimental-strip-types scripts/log-server.ts

# Deno
deno run --allow-net --allow-write --allow-read scripts/log-server.ts
```

| Flag | Default | Description |
|------|---------|-------------|
| `-p`, `--port` | `28080` | Listen port |
| `--timeout` | `15m` | Auto-shutdown after this idle period (e.g. `30s`, `15m`, `1h`, or milliseconds like `900000`) |
| `-h`, `--help` | — | Show usage |

The server binds to `127.0.0.1` only. When it exits (manual shutdown or timeout), it prints the reason to stderr.

**Important:** Call `GET /shutdown` when debugging is done, or rely on `--timeout` so the process does not stay running indefinitely. On shutdown (manual or timeout), the server deletes all session log files it created.

### HTTP API

Base URL: `http://127.0.0.1:<port>`. Request bodies are JSON (`Content-Type: application/json`).

| Method | Path | Body | Success |
|--------|------|------|---------|
| `POST` | `/new` | `{ "id": "...", "path": "..." }` | `201` — create session and open log file |
| `POST` | `/log` | `{ "id": "...", "message": "..." }` | `200` — append one line |
| `POST` | `/end` | `{ "id": "..." }` | `200` — close session (log file kept on disk) |
| `GET` | `/sessions` | — | `200` — `{ "sessions": [...] }` |
| `GET` | `/shutdown` | — | `200` then server exits and deletes all session log files |
| `GET` | `/` | — | `200` — health check |

- **id:** Human-readable session id; letters, digits, `-`, `_` only.
- **path:** Log file path (parent directories are created automatically). Suggested path is project root folder (such as `{PROJECT_ROOT}/issue-blablabla.log`).

### Example workflow

```bash
# Terminal 1: start server (optional custom port / timeout)
bun scripts/log-server.ts -p 28080 --timeout 15m

# Terminal 2: instrumented debug session
curl -s -X POST http://127.0.0.1:28080/new -H "Content-Type: application/json" \
  -d '{"id":"episode-rename","path":"./debug-logs/episode-rename.log"}'
curl -s -X POST http://127.0.0.1:28080/log -H "Content-Type: application/json" \
  -d '{"id":"episode-rename","message":"before rename: foo.mkv"}'
curl -s http://127.0.0.1:28080/sessions
curl -s -X POST http://127.0.0.1:28080/end -H "Content-Type: application/json" \
  -d '{"id":"episode-rename"}'
curl -s http://127.0.0.1:28080/shutdown
```

Instrument application code (or temporary logging) by `POST /log` to the server while reproducing the issue. After `POST /end`, analyze the file at **path** (it remains until shutdown). Call `GET /shutdown` only after you are done reading the logs.

