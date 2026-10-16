# Job Management

**Supported Platform** CLI, Web UI, Electron, ohos


## Concepts

**External Command Job** The job representing an external command. The log is stdout/stderr (and progress lines) written by the job. Download video via yt-dlp is implemented as Core `YtdlpJob`. FFmpeg conversion still runs in the UI JobOrchestrator / IndexedDB path.

**Internal Job** The job representing an internal job, such as importing a folder or scraping metadata. The log of the job is reported by the internal job via `appendLog`.

**Abortable Job** A job that can be stopped. Import jobs abort cooperatively at stage boundaries. `YtdlpJob` aborts by signalling the underlying `CommandPort.run` `AbortSignal`.

Jobs live in the Core process that created them (in-memory). They are not persisted.


## Core

`JobManager` runs two queues:

| Queue | Concurrency | Default timeout | Used by |
|-------|-------------|-----------------|---------|
| `default` | 1 | 5 minutes | import-folder, import-library, scrape |
| `ytdlp` | 1 | 1 hour (per submit) | `YtdlpJob` |

Both queues share the same `jobs` Map, so `getJob` / `listJobs` / `stopJob` / `waitForJobUntilCompleted` do not need a queue argument.

```
core.importFolder(path, type)     → { id }
core.downloadVideo(request)       → { id }   // YtdlpJob on ytdlp queue
core.inspectVideo(request)        → InspectVideoResult  // not a Job
core.getJob(id)                   → Job snapshot (no log body)
core.listJobs()                   → Job[]
core.getJobLog(id)                → log text / lines
core.stopJob(id)                  → void (tryAbort on pending/running)
```

`getJob` does not include logs. `YtdlpJob` snapshots include `progress` / `speedBps` / `etaSeconds`. Failed or aborted download jobs do not delete already-written video files.

See [Download Video](./download-video.md) and [Core JobManager design](../superpowers/specs/2026-09-15-core-job-manager-design.md).


## HTTP

Web UI, Electron, and ohos talk to the long-lived CLI/Electron server:

```
POST /api/get-jobs     {}              → { data: { jobs } }
POST /api/get-job      { id }          → Job snapshot
POST /api/get-job-log  { id }          → { lines } / text
POST /api/stop-job     { id }          → { id }
POST /api/ytdlp-inspect { url, … }     → InspectVideoResult
POST /api/download-video { url, folder, … } → { data: { id } }
```

Web UI polls `get-job` (~1s) for import and ytdlp status. Download progress comes from the `YtdlpJob` snapshot, not from command-log polling. Logs use `POST /api/get-job-log`.


## CLI

```bash 
smm job <job-id>       # print job status
smm job log <job-id>   # print log messages, one per line
smm job stop <job-id>  # abort the job
smm download <url> --folder <path>   # enqueue YtdlpJob and wait
```

No generic start command. Jobs are created by commands such as `smm add <folder>` or `smm download`.

`smm job*` talks to in-process Core (same as today). A second CLI process cannot see or stop a job from `smm add` or from the HTTP server. To stop a job started via UI/HTTP, call `POST /api/stop-job` against that server.

## Web UI, Electron, ohos

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant C as Core

  U->>B: Start download / import
  B->>C: POST /api/download-video or /api/import-folder
  C-->>B: { id }
  loop poll ~1s
    B->>C: POST /api/get-job
    C-->>B: Job snapshot
  end
```

## References

[Supported Platform](./supported-platform.md)
[Import Folder](./import-folder.md)
[Download Video](./download-video.md)
[Job Definition](../../apps/core/src/jobs/types.ts)
[Core JobManager design](../superpowers/specs/2026-09-15-core-job-manager-design.md)
