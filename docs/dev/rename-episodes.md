# Rename Episodes

**Supported Platform** Web UI, CLI, Electron, ohos, MCP tool, AI tool
**Status** wip

SMM provides 3 renaming functions:
**Rename Folder** rename media folder, see [Rename Folder](./rename-folder.md)
**Rename Episodes** Rename recognized episode files all at once
**Rename Episode** Rename single recognized episode file, see [Rename Episode File](./rename-episode-file.md)

This page is for **Rename Episodes**. Don't get confused.


## CLI

```
smm try-to-rename <folder> [--rule plex|emby]
smm reject <planId>
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


## Web UI, Electron and ohos

### UC1: Rename episodes

When user click the rename button
Then UI display rename plan with default naming rule(Plex/Emby)
When user click the confirm button
Then SMM apply plan to rename episode files

```mermaid
sequenceDiagram
  participant U as User
  participant W as UI
  participant S as Server
  participant C as Core

  U->>W: click rename button
  W->>S: POST /api/try-to-rename-episodes
  S->>C: tryToRenameEpisodes()
  C->>S: plan id + data
  S->>W: plan id + data
  W->>U: display plan
  U->>W: click confirm button
  W->>S: POST /api/apply-plan
  S->>C: applyPlan()
  W->>W: invalidate useMediaMetadataQuery
```


### UC2: Switch naming rule

When user click the rename button
Then UI display rename plan with default naming rule(Plex/Emby)
When user switch to another naming rule
Then UI display new rename plan

```mermaid
sequenceDiagram
  participant U as User
  participant W as UI
  participant S as Server
  participant C as Core

  U->>W: click rename button
  W->>S: POST /api/try-to-rename-episodes
  S->>C: tryToRenameEpisodes()
  C->>S: plan id + data
  U->>W: switch naming rule
  W->>S: POST /api/reject-plan
  S->>C: rejectPlan()
  W->>S: POST /api/try-to-rename-episodes
  S->>C: tryToRenameEpisodes()
  S->>W: plan id + data
  W->>U: display plan
  U->>W: click confirm button
  W->>S: POST /api/apply-plan
  S->>C: applyPlan()
  W->>W: invalidate useMediaMetadataQuery
```

## MCP Tool and AI Tool

AI and MCP clients use a single tool, **`create-rename-episode-plan`**, instead of the former begin/add/end rename task flow.

Input:

- `mediaFolderPath` — absolute media folder path (POSIX or Windows)
- `files` — non-empty array of `{ from, to }` video paths chosen by the agent

The tool calls `Core.createRenameEpisodePlan(..., { creator: "ai" })`, writes a pending rename plan under `{appDataDir}/plans/`, broadcasts **`RenameFilesPlanReady`**, and returns a success message telling the user to open SMM and approve the plan. Confirm/reject/apply follow [Manage Plan](./manage-plan.md) (`POST /api/apply-plan`, `POST /api/reject-plan`).

HTTP surface (same Core call): `POST /api/create-rename-episode-plan`. E2e/debug helper: `POST /debug/createRenameEpisodePlan`.

```mermaid
sequenceDiagram
  participant U as User
  participant A as AI Agent
  participant T as MCP Tool/AI Tool
  participant C as Core
  participant W as UI

  U->>A: ask for renaming episodes
  A->>T: create-rename-episode-plan(folder, files)
  T->>C: createRenameEpisodePlan(..., creator ai)
  C->>T: RenameFilesPlan (pending)
  T->>W: RenameFilesPlanReady
  T->>A: success message (review in SMM)
  A->>U: message to user
  U->>W: review + confirm
  W->>C: applyPlan()
```


## Testing

| Use Case | Platform | Test |
|--|--|--|
| UC1 | Web UI, Electron and Ohos | apps/e2e/common/tv/TVShow-RenameEpisodes.e2e.ts |
| UC1 | CLI | apps/e2e/cli/rename-episodes.test.ts |
| UC2 | Web UI, Electron and Ohos | apps/e2e/common/tv/TVShow-RenameEpisodes.e2e.ts |
| UC2 | CLI | apps/e2e/cli/rename-episodes.test.ts |
| AI rename plan | MCP tool, AI tool | apps/e2e/test/specs/ai/AiTool-RenameTool.e2e.ts |


## References

[Manage Plan](./manage-plan.md)

[Recognize](./recognize.md)

[Rename Episode File](./rename-episode-file.md) — single-episode context-menu rename (not rule batch)

[Supported Platform](./supported-platform.md)
