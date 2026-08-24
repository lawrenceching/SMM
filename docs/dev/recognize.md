# Recognize (episode file mapping)

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

## CLI

```
smm try-to-recognize <folder>
smm apply <planId>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm try-to-recognize <folder>
  CLI->>Core: tryToRecognizeFolder(folder)
  Core->>Fs: listFiles + read metadata
  Core->>Core: match videos to episodes
  Core->>Fs: write plans/{id}.plan.json
  Core-->>CLI: RecognizeMediaFilePlan (pending)
  CLI-->>User: plan id + matched files
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm apply <planId>
  CLI->>Core: getPlan(planId)
  CLI->>Core: applyPlan(plan)
  Core->>Fs: update metadata cache
  Core->>Fs: delete plan file
  Core-->>CLI: void
  CLI-->>User: applied N file(s)
```

```mermaid
flowchart TD
  A[try-to-recognize] --> B{folder managed?}
  B -->|no| Z[error]
  B -->|yes| C{tvshow-folder with episodes?}
  C -->|no| Z
  C -->|yes| D[list video files on disk]
  D --> E[rule match SxxExx / pattern]
  E --> F[build pending plan]
  F --> G[persist plan.json]
  G --> H[apply updates mediaFiles]
```

## Web UI, Electron and ohos

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant CLI
  participant Core

  User->>Browser: Recognize confirm
  Browser->>CLI: POST /api/createPlan + updatePlan
  CLI->>Core: plan CRUD + applyPlan
  Core-->>CLI: updated metadata
  CLI-->>Browser: { data: plan }
  Note over Browser: upsert mediaFiles (Zustand)
```

## References

[Import Folder](./import-folder.md)

[Supported Platform](./supported-platform.md)
