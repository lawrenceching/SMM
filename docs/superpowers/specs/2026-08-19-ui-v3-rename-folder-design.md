# UI v3 rename via POST /api/rename-folder → Core.renameFolder

## 1. Background

Sidebar rename today calls `POST /api/renameFolder` → `packages/core-routes` `doRenameFolder`. Layer 2 now has `Core.renameFolder` with the same orchestration. Under `localStorage["smm.v3.enabled"] === "true"`, the UI should drive rename through Core (same pattern as `get-folders` / `unimport-folder`), without changing the legacy `/api/renameFolder` path used by non-v3 UI, MCP, and tools.

## 2. Architecture

```
Sidebar RenameDialog
  → useRenameMediaFolderMutation
       ├─ v3 OFF → POST /api/renameFolder → core-routes doRenameFolder (unchanged)
       └─ v3 ON  → POST /api/rename-folder → getCore().renameFolder → FsPort + UserConfig
            → refreshUiAfterFolderRename + invalidateFoldersQueryIfV3
            → socket broadcasts (same events as legacy rename) for listeners
```

| Layer | Change |
|-------|--------|
| `apps/core` | No change (already has `renameFolder`) |
| `apps/cli` | New `POST /api/rename-folder` route; register in `server.ts` |
| `apps/ui` | API client + mutation branches on `isSmmV3Enabled()` |
| `packages/core-routes` | Untouched |

## 2.3 Key Design

**HTTP** `POST /api/rename-folder`

- Body: `{ from: string, to: string }` (absolute paths; platform or POSIX)
- Success: `{ data: { from, to } }` (echo request paths)
- Failure: `{ error: "Error Reason: …" }` (map `Core.renameFolder` throws)
- HTTP status: `200` for business success/failure (project API guideline)
- After success: broadcast `userConfigFolderRenamed` + `userConfigUpdated` (parity with legacy `RenameFolder.ts` so socket listeners keep working)

**UI**

- `isSmmV3Enabled()` → call new client; else existing `renameFolder` / `postRenameFolder`
- After successful rename: existing `refreshUiAfterFolderRename` **plus** `invalidateFoldersQueryIfV3` so `useFoldersQuery` picks up the new path

## 3. Out of scope

- Changing MCP / AI rename tools
- Removing or rewriting `POST /api/renameFolder`
- Browser `NetworkFsAdapter.rename` (still NYI)

## 4. Testing

- CLI route unit test: happy path + validation + Core throw → error body (TDD)
- UI mutation unit test if existing patterns cover v3 branching; otherwise thin test on API helper choice
