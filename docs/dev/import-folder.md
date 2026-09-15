# Import Folder

**Supported Platform** Web UI, CLI, Electron, ohos


When user import a folder, SMM starts the "Folder Initialization" process in below stages:
1. Persist new folder
2. Start to [Recognize Media Folder](../../AGENTS.md#核心术语), see [Recognize Folder Spec](./recognize-folder.md)
3. Start to [Recognize Episode Video File](../../AGENTS.md#核心术语), see [Recognize Episodes Spec](./recognize-episodes.md)


## apps/core

```mermaid
sequenceDiagram
  participant Caller
  participant Core
  participant Fs as FsPort

  Caller->>Core: importFolder(path, type)
  Core->>Core: create ImportFolderJob (job is in pending status)

  Note over Core,Fs: Stage 1
  Core->>Fs: write smm.json
  Core->>Fs: write metadata file
  Core-->>Caller: { id }

  Note over Core,Fs: Start
  Core->>Core: move job to running status

  Note over Core,Fs: Stage 2
  Core->>Core: recognize folder

  Note over Core,Fs: Stage 3
  Core->>Core: recognize episode video files

  Note over Core,Fs: End
  Core->>Core: move job to succeeded status

  loop poll
    Caller->>Core: getJob(id)
    Core-->>Caller: ImportJob
  end

  Caller->>Core: getFolders()
  Core->>Fs: read smm.json
  Core-->>Caller: folders[]

  Caller->>Core: getMediaMetadata(path)
  Core->>Fs: read metadata cache
  Core-->>Caller: MediaMetadata | null
```

note: `importFolder` interface return when stage 1 completed. Caller(Web UI or CLI) loop to query the job status until job is succeeded, failed, or aborted.

note2: core layer already provides methods to recognize folder and recognize episodes.
`docs/dev/recognize-folder.md` and `docs/dev/recognize-episodes.md` described the process of user-triggered recognition process. The recognition process triggered by initialization share the low level recognition methods with user-triggered recognition process.


## Web UI, Electron and ohos

Web UI talks to Core via Internal HTTP (`apps/cli`). Electron and ohos reuse the same UI bundle.

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant CLI
  participant Core

  User->>Browser: click import button
  Browser->>CLI: POST /api/import-folder { path, type }
  CLI->>Core: importFolder(path, type)
  Core-->>CLI: { id }
  CLI-->>Browser: { data: { id } }
  Note over Browser: upsertFolder status=initializing (Zustand)
  loop poll ~1s
    Browser->>CLI: POST /api/get-job { id }
    CLI->>Core: getJob(id)
    Core-->>CLI: ImportJob
    CLI-->>Browser: { data: ImportJob }
  end
  Browser->>CLI: POST /api/get-folders
  CLI->>Core: getFolders()
  Core-->>CLI: folders[]
  CLI-->>Browser: { data: { folders } }
  Browser->>CLI: POST /api/show-folder { path }
  CLI->>Core: getFolders() + getMediaMetadata(path)
  Core-->>CLI: folders[] + MediaMetadata | null
  CLI-->>Browser: { data: { path, status, ... } }
  Note over Browser: upsertFolder status from show-folder (Zustand)
```

See [apps/core](#appscore) for pipeline stages and persistence details.

## CLI

```bash
smm add <folder> --type tvshow|movie|music|anime [--verbose] [--skip-init]
smm list
smm show <folder>
smm metadata <folder>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core

  User->>CLI: smm add <folder> --type tvshow
  activate CLI
  CLI->>Core: importFolder(path, type)
  Core-->>CLI: { id }
  loop poll internally (~1s, not shown to user)
    CLI->>Core: getJob(id)
    Core-->>CLI: ImportJob
  end
  CLI-->>User: progress lines + exit 0
  deactivate CLI

  User->>CLI: smm show <folder>
  CLI->>Core: getFolders() + getMediaMetadata(path)
  Core-->>CLI: folders[] + MediaMetadata | null
  CLI-->>User: Path / Status / Type / Title
```

See [apps/core](#appscore) for pipeline stages and persistence details.

## Test

See [test cases](./test/import-folder-test.md)

## References

[Supported Platform](./supported-platform.md)
[Job Definition](../../apps/core/src/jobs/types.ts)
