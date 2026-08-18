# `smm show` and `smm metadata` CLI commands

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

After `smm list` / `smm add`, operators need to inspect an imported folder:

- **Status** aligned with UI `UIMediaFolderStatus` names (not a vague “status” dump of everything)
- **Media metadata** as a human-readable view of `Core.getMediaMetadata()`

These are two commands. Output is user-friendly text, not JSON.

## 2. Architecture

```
smm show <folder>       → resolveShowFolder → formatShowFolder
smm metadata <folder>   → getMediaMetadata → formatMediaMetadata
         │
         ▼
getCore()  (apps/core)
```

## 3. Commands

### 3.1 `smm show <folder>`

Path required.

| Condition | Status printed | Exit |
|-----------|----------------|------|
| Not in `getFolders()` | stderr `Folder is not imported` | 1 |
| Imported, path missing on disk | `folder_not_found` | 0 |
| Imported, no/corrupt metadata cache | `error_loading_metadata` | 0 |
| Imported, cache readable | `ok` (+ Type, Title when present) | 0 |

Runtime-only UI states (`initializing`, `loading`, …) are not synthesized by the CLI.

### 3.2 `smm metadata <folder>`

Path required. Prints human-readable `MediaMetadata` fields (except `files`, which is not persisted):

- `mediaFolderPath`, `type` when present
- `tvShow` / `movie` nested fields when present (omitted if absent — no invented “unrecognized”)
- `mediaFiles` list when present

Exit 1 if not imported or no cache.

## 4. Files

- `apps/cli/src/cli/folderDisplay.ts` — resolve / format helpers
- `apps/cli/src/cli/runCli.ts` — Commander `show` / `metadata`
- `apps/cli/src/cli/show.test.ts`, `metadata.test.ts`
