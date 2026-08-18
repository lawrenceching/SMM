# `smm add --skip-init` / `Core.importFolder({ skipInit })`

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

`smm add` always runs the full importFolder pipeline (list files, recognize, persist metadata). Operators sometimes only need the folder registered in `UserConfig.folders` (e.g. defer recognition, or batch-register paths).

## 2. Architecture

### 2.1 Project Level

```
smm add --skip-init  →  Core.importFolder(path, type, { skipInit: true })
                              → UserConfig.folders only
                              → job succeeds (no metadata / recognize)
```

### 2.2 Key Design

- `Core.importFolder(path, type, options?: { skipInit?: boolean })`
- `skipInit: true`: append path to `folders` (Set union, same as pipeline config stage), mark job `succeeded`; **no** metadata cache, **no** listFiles/recognize/episodes/persist
- CLI: `--skip-init` still requires `--type`; prints only `imported folder <path>`; exit 0 on success
- Missing-on-disk path is allowed (config-only write)
- Default (`skipInit` omitted/false): unchanged full pipeline + progress lines

## 3. User Stories

### 3.1 Skip init

* **Given** - a folder path (may or may not exist on disk)
* **When** - `smm add <folder> --type music --skip-init`
* **Then** - path is in `smm.json` folders; stdout is `imported folder <folder>`; no metadata cache file; exit 0
