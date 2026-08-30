# Manage Folders

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** done


## Import Folder

See [Import Folder](./import-folder.md)


## Web UI, Electron and ohos


### List Folders

```mermaid
sequenceDiagram
  participant Browser
  participant CLI
  participant Core

  Browser->>CLI: POST /api/get-folders
  CLI->>Core: getFolders()
  Core-->>CLI: folders[]
  CLI-->>Browser: { data: { folders } }
```

### Unimport Folders

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant CLI
  participant Core

  User->>Browser: delete folder
  Browser->>CLI: POST /api/unimport-folder { path }
  CLI->>Core: unimportFolder(path)
  Core-->>CLI: void
  CLI-->>Browser: { data: { path } }
```

## CLI

### List Folders

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core

  User->>CLI: smm list
  CLI->>Core: getFolders()
  Core-->>CLI: folders[]
  CLI-->>User: one line per folder
```

### Unimport Folders

```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Core

  User->>CLI: smm rm <folder>
  CLI->>Core: getFolders() (isFolderImported check)
  CLI->>Core: unimportFolder(path)
  CLI-->>User: exit 0
```

## References

[Import Folder](./import-folder.md) — full import pipeline (without `--skip-init`)

[Supported Platform](./supported-platform.md)
