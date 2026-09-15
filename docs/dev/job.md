# Job Management

**Supported Platform** CLI, Web UI, Electron, ohos


## Concepts

**External Command Job** The job representing an external command. The log of External Command Job is the stdout and stderr output. For example, download video using yt-dlp, video conversion using ffmpeg. (Not implemented in Core JobManager yet.)

**Internal Job** The job representing an internal job, such as importing a folder or scraping metadata. The log of the job is reported by the internal job via `appendLog`.

**Abortable Job** A job that can be stopped or interrupted. This iteration: ImportJob only, at folder-initialization stage 2 or 3.

Jobs live in the Core process that created them (in-memory). They are not persisted.


## Core

`JobManager` replaces the old in-memory `JobStore`. `create` / `update` / `get` stay compatible for scrape and import-library jobs. Import jobs also use a `JobHandle` (`appendLog`, `requestStop`, `throwIfAborted`, `update`).

```
core.importFolder(path, type) → { id }
core.getJob(id)               → Job snapshot (no log body)
core.getJobLog(id)            → JobLogLine[]
core.stopJob(id)              → void (ImportJob pending/running only)
```

`getJob` does not include logs. `stopJob` on a non-import job or a finished job fails. Abort is cooperative at stage boundaries; in-flight network calls finish the current request. Failed or aborted jobs do not roll back smm.json / metadata.

See [Core JobManager design](../superpowers/specs/2026-09-15-core-job-manager-design.md).


## HTTP

Web UI, Electron, and ohos talk to the long-lived CLI/Electron server:

```
POST /api/get-job      { id }  → Job snapshot
POST /api/get-job-log  { id }  → { lines }
POST /api/stop-job     { id }  → { id }
```

Use these to inspect or abort an import started by `POST /api/import-folder`. Web UI import still polls `get-job` only; it does not call stop/log in this iteration.


## CLI

```
smm job <job-id>       # print job status
smm job log <job-id>   # print log messages, one per line
smm job stop <job-id>  # abort the job
```

No start command. The job is created by another command such as `smm add <folder>`.

`smm job*` talks to in-process Core (same as today). A second CLI process cannot see or stop a job from `smm add` or from the HTTP server. To stop an import started via UI/HTTP, call `POST /api/stop-job` against that server.


## References

[Supported Platform](./supported-platform.md)
[Import Folder](./import-folder.md)
[Job Definition](../../apps/core/src/jobs/types.ts)
[Core JobManager design](../superpowers/specs/2026-09-15-core-job-manager-design.md)
