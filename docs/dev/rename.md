# Rename (media folder or episode file)

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done

## CLI

```
smm rename <from> <to>
smm rename-episode-file <folder> --from <path> --to <path>
```

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core
  participant Fs as FsPort

  User->>CLI: smm rename <from> <to>
  CLI->>Core: getFolders()
  CLI->>CLI: classifyRenameTarget(from)
  alt managed media folder
    CLI->>Core: renameFolder({ from, to })
    Core->>Fs: rename dir + smm.json + metadata cache
  else linked episode file
    CLI->>Core: renameEpisodeFile({ mediaFolderPath, from, to })
    Core->>Fs: rename episode + same-stem associates
    Core->>Fs: update metadata cache
  end
  CLI-->>User: from → to line(s)
```

```mermaid
flowchart TD
  A[smm rename from to] --> B{from equals managed folder root?}
  B -->|yes| C[renameFolder]
  B -->|no| D{from under managed folder?}
  D -->|no| Z[error: not managed]
  D -->|yes| E{from is directory?}
  E -->|yes| F[error: not media root]
  E -->|no| G[renameEpisodeFile + expand associates]
  C --> H[update list + metadata paths]
  G --> H
```

## Web UI, Electron and ohos

### Rename media folder

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant CLI
  participant Core

  User->>Browser: sidebar rename folder
  Browser->>CLI: POST /api/rename-folder { from, to }
  CLI->>Core: renameFolder({ from, to })
  Core-->>CLI: void
  CLI-->>Browser: { data: { from, to } }
```

### Rename episode file

See [Rename Episode File](./rename-episode-file.md).

## References

[Rename Files](./rename-files.md) — plex/emby batch plan

[Rename Episode File](./rename-episode-file.md)

[Supported Platform](./supported-platform.md)
