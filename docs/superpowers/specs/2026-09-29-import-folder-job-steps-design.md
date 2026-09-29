# ImportFolderJob Step Refactor

## 1. Background

`recognitionDeps` factory on `ImportFolderJobOptions` forced callers (Core) to assemble recognition clients. Callers should only inject platform ports. Job owns recognition orchestration via Step list.

## 2. Architecture

### Lifecycle (unchanged)

1. Core calls `persistFolder()` (stage 1), returns `{ id }` to caller.
2. Unless `skipInit`, Core fires `run()` asynchronously.

### `run()` Steps

| type | steps |
|------|--------|
| tvshow / movie | recognize folder → recognize episode files |
| music | listFiles only (fail if unreadable); no recognition steps |

### Options after change

- Remove `recognitionDeps`
- Add `network: NetworkPort`, `appDataDir: string`, optional `osLocale`, optional `discover` / `hostPerformance`
- Keep `fs`/`logger` from `JobOptions`, plus `userConfig` / `mediaMetadata`

### Shared deps factory

`pipeline/createRecognitionDeps.ts` builds `RecognizeFolderDeps` from ports + helpers. Used by Core and ImportFolderJob.

### Pipeline split

- `recognizeImportedFolder` / `recognizeImportedEpisodes` — Stage 2 / 3
- `initializeFolder` remains as a thin composition wrapper for existing tests

## 3. User Stories

* **Given** an import folder job for a tvshow
* **When** `run()` executes
* **Then** it lists files, recognizes the folder, then episode files, updating job stage/progress without a caller-supplied recognitionDeps factory
