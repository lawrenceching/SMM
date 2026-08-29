# AI Rename Episodes (superseded)

> **This document is outdated.** AI/MCP episode rename no longer uses the three-step `beginRenameFilesTask` → `addRenameFileToTask` → `endRenameFilesTask` flow (in-memory task cache + incremental Socket preview).

Use the single-tool design instead:

- **Tool:** `create-rename-episode-plan` (`CREATE_RENAME_EPISODE_PLAN`)
- **Core:** `Core.createRenameEpisodePlan(mediaFolderPath, files, { creator: "ai" })`
- **Outcome:** pending rename plan on disk + `RenameFilesPlanReady` → user reviews in SMM → `apply-plan`

**Current docs**

- [Rename Episodes](../../dev/rename-episodes.md) — product flow, CLI/UI/AI sequences, tests
- [Manage Plan](../../dev/manage-plan.md) — apply, reject, list plans
- [Design spec](../specs/2026-08-29-create-rename-episode-plan-design.md) — architecture and validation rules

**E2e helper:** `POST /debug/createRenameEpisodePlan` (see [Debug API](../../DebugAPI.md))
