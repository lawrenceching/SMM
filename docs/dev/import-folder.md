# Import Folder

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

## apps/core

Layer 2 entry points used by all frontends:

| Method | Role |
|--------|------|
| `importFolder(path, type, { skipInit? })` | Start import; returns `{ id }` immediately; runs pipeline in background |
| `getJob(id)` | Poll in-memory import job (`status`, `stage`, `progress`, `error`) |
| `getFolders()` | List imported folder paths from `smm.json` |
| `getMediaMetadata(path)` | Read persisted metadata cache; used by `resolveShowFolder` for folder status |

`importFolder` pipeline (`ImportFolderPipeline`):

```
config → metadata → listFiles → recognize → episodes → persist
```

- **config** — add path to `userConfig.folders`, write `smm.json`
- **metadata** — create blank `MediaMetadata` with folder type
- **listFiles** — list directory files via `FsPort`
- **recognize** — tvshow/movie only (NFO → id in folder name → search); music skips
- **episodes** — match video files to episodes (tvshow) or pick first video (movie)
- **persist** — write metadata cache under `<appDataDir>/metadata/`

```mermaid
sequenceDiagram
  participant Caller
  participant Core
  participant Pipeline as ImportFolderPipeline
  participant Fs as FsPort
  participant Net as NetworkPort

  Caller->>Core: importFolder(path, type)
  Core->>Core: create job (running)
  Core-->>Caller: { id }
  Core->>Pipeline: run (background)
  Pipeline->>Fs: read/write smm.json
  Pipeline->>Fs: listFiles(path)
  Pipeline->>Net: TMDB/TVDB (recognize)
  Pipeline->>Fs: write metadata cache
  Pipeline-->>Core: job.status = succeeded | failed

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

Folder status values (`ok` | `folder_not_found` | `error_loading_metadata`) are derived in the CLI helper `resolveShowFolder` from `getFolders()`, on-disk path check, and `getMediaMetadata()`.

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
