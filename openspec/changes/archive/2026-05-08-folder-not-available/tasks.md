## 1. CLI: folder availability endpoint

- [x] 1.1 Add `POST /api/isFolderAvailable` route module (request body with folder path, JSON response with boolean or `{ available }`), using `fs` to verify directory exists and is accessible; return 4xx on invalid body
- [x] 1.2 Register the route in the CLI app bootstrap alongside existing `/api/*` routes
- [x] 1.3 Add unit tests for the handler (available dir, missing path, file-not-dir, invalid JSON)

## 2. UI: API client and store initialization

- [x] 2.1 Add a small API helper (or extend existing API layer) to call `POST /api/isFolderAvailable` with the stored folder path
- [x] 2.2 After user config folders are synced into `uiMediaFolderStore`, run the availability check per folder and set `status` to `folder_not_found` when the API reports unavailable; handle network/API errors without crashing (define: leave status or use existing error status consistently)
- [x] 2.3 Ensure path strings match those used elsewhere (no double normalization issues)

## 3. UI: Folder-not-available panel and routing

- [x] 3.1 Create `FolderNotAvailablePanel` with copy explaining the folder is missing or unreachable; wire strings through `react-i18next` for `en`, `zh-CN`, `zh-HK`, `zh-TW`
- [x] 3.2 Update `AppV2` (or single routing choke point for main content) so when the selected `UIMediaFolder.status === 'folder_not_found'`, render `FolderNotAvailablePanel` instead of TvShow / Movie / Music / local file panels

## 4. Verification

- [ ] 4.1 Manually verify: configured path deleted or wrong drive → panel appears; restored path → normal panels after re-select or refresh as implemented
- [x] 4.2 Run `pnpm test:cli` and UI tests / typecheck as appropriate for touched packages
