# Import Library

**Supported Platform** Web UI, CLI, Electron, ohos  
**Status** wip

## Core

Reuses [import folder](./import-folder.md). Job shape: [ImportLibraryJob](../../packages/core/job/ImportLibraryJob.ts).

```mermaid
sequenceDiagram
  participant U as Upstream
  participant C as Core
  participant UC as UserConfigHelper
  participant M as MediaMetadataHelper
  participant E as Core events

  U->>C: importLibrary(path, type)
  C->>C: create job (pending) + tasks (pending)
  C->>U: job id
  loop #1 prep
    C->>M: blank metadata per folder
  end
  C->>UC: batch upsert folders
  C->>C: job → running
  loop #2 import each folder
    C->>C: task → running → importFolder
    C->>C: task → succeeded | failed
    C->>E: emit mediaMetadataUpdated
  end
  C->>C: job → succeeded | failed
```

- **Loop #1**: Sidebar can list folders early; blank metadata must exist before UserConfig upsert.
- **Loop #2**: Each `importFolder` persist completion emits `mediaMetadataUpdated` (not Loop #1, not `skipInit` blank writes). Host subscribes via `core.on(...)` and forwards to Socket.IO.

## CLI

```bash
smm addlib "<path>" --type tvshow|movie|music|anime [--skip-init]
```

Poll `getJob(jobId)` until the import-library job settles.

## Web UI, Electron and ohos

```mermaid
sequenceDiagram
  participant W as Web UI
  participant S as Server
  participant C as Core

  W->>S: POST /api/import-library
  S->>C: importLibrary
  S->>W: job id
  W->>W: refresh Sidebar (UserConfig + job tasks)
  par poll job
    W->>S: POST /api/get-job
  and metadata push
    C->>S: core.on → emit mediaMetadataUpdated
    S->>W: Socket.IO mediaMetadataUpdated
    W->>W: fetchMediaMetadata (selected folder)
  end
```

- Sidebar status: `ImportLibraryJob.tasks[]` via get-job poll.
- Panel content (TvShowPanel, etc.): existing `MediaMetadataUpdatedEventListener` refetches metadata when the selected folder’s import completes.

## Testing

| Use Case | Platform | File |
|--|--|--|
| UC1 | Web UI, Electron, ohos | `apps/e2e/common/ImportLibrary.e2e.ts` |
| UC1 | CLI | `apps/e2e/cli/import-library.test.ts` |

### UC1: import tvshow/movie/music libraries
