# Import Library

**Supported Platform** Web UI, CLI, Electron, ohos
**Status** wip

## Core

The function of importing library reuses the function of [importing folder](./import-folder.md).

```mermaid
sequenceDiagram
  participant U as Upstream
  participant C as C
  participant UC as UserConfigHelper
  participant M as MediaMetadataHelper

  U->>C: importLibrary(path, type)
  C->>C: create job
  C->>U: job id
  C->>C: read folders in library
  loop #1: for each folder
    C->>M: create blank metadata file
    C->>UC: upsert folder in UserConfig
  end
  loop import folders
    C->>C: importFolder(jobId)
  end
  C->>C: update job status
```

> #1: this loop supports Web UI to render folder list immediately after user import library.
> Web UI first get folder list from user config. And then get folder status from media metadata.
> So we need to create metadata file before upsert folder in UserConfig
> To avoid Web UI find new folder but fail to get its metadata


## CLI

```bash
smm addlib "<path>" --type --type tvshow|movie|music|anime --skip-init
```

```mermaid
sequenceDiagram
  participant U as User
  participant S as CLI
  participant C as Core

  U->>S: smm addlib "<path>"
  S->>C: importLibrary(path, type)
  C->>S: job id
  loop looping job status
    S->>C: getJob(jobId)
  end
  S->>U: print result
```

## Web UI, Electron and ohos

TODO: There is bug
The folder list was not updated before importFolder job completed.
UI should show all folders at the first step
and then run import job to trigger init process

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web UI
  participant S as Server
  participant C as Core

  U->>W: import library
  W->>S: POST /api/import-library
  S->>C: importLibrary(path, type)
  C->>S: job id
  S->>W: job id
  W->>U: display job in running status
  W->>W: invalidate useUserConfigQuery
  W->>W: display folders in Sidebar
  loop looping job status
    W->>S: /api/get-job
    S->>C: getJob(jobId)
    C->>S: return
    S->>W: return
  end
  W->>U: display job in success/failure status
```

## Testing 

| Use Case | Platform | File |
|--|--|--|
|UC1|Web UI, Electron, ohos| apps/e2e/common/ImportLibrary.e2e.ts|
|UC1|CLI| apps/e2e/cli/import-library.test.ts|

### UC1: import tvshow/movie/music libraries