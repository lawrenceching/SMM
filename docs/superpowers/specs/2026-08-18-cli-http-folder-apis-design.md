# CLI ↔ HTTP folder APIs

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

`smm list` / `add` / `show` / `metadata` / `rm` are Layer 3 CLI commands over Core. HTTP already had `POST /api/get-folders` and `POST /api/unimport-folder`. Import / show / metadata / job poll were missing, so HTTP clients could not drive the same Core operations.

## 2. Mapping

| CLI | HTTP | Core |
|-----|------|------|
| `smm list` | `POST /api/get-folders` (existing) | `getFolders()` |
| `smm add` | `POST /api/import-folder` | `importFolder(path, type, { skipInit? })` |
| (add wait) | `POST /api/get-job` | `getJob(id)` |
| `smm show` | `POST /api/show-folder` | `resolveShowFolder` |
| `smm metadata` | `POST /api/folder-metadata` | `getMediaMetadata` (omit `files`) |
| `smm rm` | `POST /api/unimport-folder` (existing) | `unimportFolder` |

Naming may differ (`list` vs `get-folders`) because CLI and HTTP target different users.

HTTP import returns a job id immediately; clients poll `get-job` (CLI already waits in-process).
