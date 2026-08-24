# Rename Files (plex / emby rule)

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

## CLI

```
smm try-to-rename <folder> [--rule plex|emby]
smm apply <planId>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm try-to-rename <folder> --rule plex
  CLI->>Core: tryToRenameFolder(folder, rule)
  Core->>Fs: read metadata + listFiles
  Core->>Core: build rename pairs (video + associates)
  Core->>Fs: write plans/{id}.plan.json
  Core-->>CLI: RenameFilesPlan (pending)
  CLI-->>User: plan id + from → to lines
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
  Core->>Fs: mkdir + rename files
  Core->>Fs: update metadata cache
  Core->>Fs: delete plan file
  Core-->>CLI: void
  CLI-->>User: applied N file(s)
```

```mermaid
flowchart TD
  A[try-to-rename] --> B{folder managed tvshow?}
  B -->|no| Z[error]
  B -->|yes| C{rule plex or emby?}
  C -->|no| Z
  C -->|yes| D[for each linked episode file]
  D --> E[compute target path under Season folder]
  E --> F{from equals to?}
  F -->|yes| G[skip]
  F -->|no| H[add pair + associate stems]
  H --> I[persist pending plan]
  I --> J[apply renames on disk]
```

## Web UI, Electron and ohos

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant CLI
  participant Core

  User->>Browser: Rename confirm (rule)
  Browser->>CLI: createPlan(rename-files) + apply
  CLI->>Core: tryToRenameFolder / applyPlan
  Core-->>CLI: metadata + disk updated
  CLI-->>Browser: { data }
```

## References

[Recognize](./recognize.md)

[Rename Episode File](./rename-episode-file.md) — single-episode context-menu rename (not rule batch)

[Supported Platform](./supported-platform.md)
