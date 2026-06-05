# executeCmd: yt-dlp PTY (pseudo-terminal) support

Add `tty: boolean = false` option to `executeCmd`, allowing the UI to run yt-dlp in a ConPTY pseudo-terminal on Windows, solving the progress output issue where yt-dlp's `write_string()` flush is ineffective through Windows anonymous pipes.

## 1. Background

**Root cause** (discovered via diagnostics): yt-dlp (PyInstaller-frozen exe on Windows) cannot flush progress output through anonymous pipes, even though `write_string()` explicitly calls `sys.stdout.flush()`. Through ConPTY (Windows Pseudo Console), yt-dlp correctly detects `isatty()=True` and real-time progress JSON lines flow normally.

**Direction 2 verified**: `CREATE_NO_WINDOW` flag is NOT the root cause.
**Direction 3 verified**: ConPTY via `node-pty` successfully receives real-time progress with the SMM `--progress-template`.

**Design decision**: Hardcode `tty: true` for all yt-dlp executeCmd invocations. No user-facing toggle.

## 2. Project Level Architecture

**None**. No changes to inter-app communication. The NDJSON streaming protocol remains identical.

## 3. App Level Architecture

### 3.1 CLI: Dual spawn path

```
                    ┌──────────────────────────────┐
                    │  POST /api/executeCmd          │
                    │  { command, args, tty? }       │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │  command === 'yt-dlp'          │
                    │  && tty === true?              │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │ YES            │                │ NO
              ▼                │                ▼
    ┌──────────────────┐       │    ┌──────────────────────┐
    │ node-pty available?│      │    │ child_process.spawn   │
    └────┬─────────┬────┘       │    │ (pipe stdio)          │
         │ YES     │ NO         │    └──────────────────────┘
         ▼         ▼            │
    ┌────────┐ ┌────────────┐   │
    │pty.spawn│ │warn + pipe │   │
    │(ConPTY) │ │fallback    │   │
    └────┬───┘ └─────┬──────┘   │
         │           │          │
         └─────┬─────┘          │
               │                │
               ▼                ▼
    ┌──────────────────────────────────┐
    │  Same NDJSON streaming output     │
    │  { type: "stdout"|"system"|... }  │
    └──────────────────────────────────┘
```

**PTY output handling**: PTY merges stdout+stderr into a single stream. All output is emitted as `stdout` NDJSON. Progress JSON parsing works identically since the parser already inspects each line.

### 3.2 UI: Transparent tty injection

```
  apps/ui/src/api/ytdlp.ts
    downloadYtdlpVideo()  →  { command: 'yt-dlp', args, tty: true }

  apps/ui/src/components/JobOrchestratorProvider.tsx
    download-video job     →  { command: 'yt-dlp', args, tty: true }
```

No UI toggle, no user-facing change. `tty: true` is hardcoded in both yt-dlp call sites.

## 4. User Stories

### 4.1 yt-dlp download with real-time progress via PTY

* **Given** a user opens DownloadVideoDialog and starts a yt-dlp download
* **When** the download is running
* **Then** BackgroundJobsPopover shows real-time progress bar, speed (MB/s), and ETA
* **And** LogDialog shows real-time progress JSON lines scrolling

## 5. Tasks

### 5.1 CLI: Add node-pty dependency

- [x] Add `node-pty` to `apps/cli/package.json` dependencies

### 5.2 CLI: PTY spawn path in executeCmd

- [x] `apps/cli/src/route/executeCmd.ts`:
  - Add `tty: z.boolean().optional().default(false)` to `executeCmdRequestSchema`
  - Try-import `node-pty` at module level (cached, with graceful fallback) — `apps/cli/src/utils/pty.ts`
  - In the streaming handler (`handleExecuteCmd`), branch on `command === 'yt-dlp' && tty && ptyAvailable`
  - PTY path: use `pty.spawn()` → `term.onData()` to merge stdout → NDJSON
  - On PTY unavailable: log warning, fall back to existing `child_process.spawn`
  - PTY path also skips `PYTHONUNBUFFERED=1` env var (unnecessary with TTY)

### 5.3 UI: Add tty to ExecuteCmdRequest

- [x] `apps/ui/src/api/executeCmd.ts`: Add `tty?: boolean` to `ExecuteCmdRequest`

### 5.4 UI: yt-dlp callers set tty: true

- [x] `apps/ui/src/api/ytdlp.ts`: Set `tty: true` in `downloadYtdlpVideo()` (only the download function; metadata/version calls left untouched)
- [x] `apps/ui/src/components/JobOrchestratorProvider.tsx`: Set `tty: true` in `executeCmdToCompletionWithHeaders` call

## 6. Backward Compatibility

- `tty` defaults to `false` → all existing callers unaffected
- PTY unavailable → silent fallback to pipe (existing behavior)
- NDJSON protocol unchanged → no breaking changes on either side

## 7. Documents

- [x] `docs/api/index.md` — add `tty` to `POST /api/executeCmd` request schema (TODO: pending)

## 8. Post Verification

- [x] Unit tests: `pnpm run test` — 228 CLI + 1034 UI tests pass
- [x] TypeScript: `pnpm typecheck` — no new errors (2 pre-existing UUID template-literal warnings unrelated to this change)
- [x] Build: `pnpm build` — CLI + UI build succeeds
- [x] End-to-end smoke test: `POST /api/executeCmd` with `tty: true` delivered 20 progress NDJSON messages during a 26-second YouTube download (exit code 0)
