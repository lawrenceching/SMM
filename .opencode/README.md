# OpenCode + OpenSpec

This directory configures [OpenCode](https://opencode.ai/) to use the same [OpenSpec](https://openspec.dev/) workflow as Cursor.

## Commands

Custom slash commands in `commands/` mirror the Cursor opsx workflow:

| Command | Description |
|---------|-------------|
| `/opsx-new` | Start a new change (step through artifacts) |
| `/opsx-ff` | Fast-forward: create all artifacts at once |
| `/opsx-continue` | Continue an existing change (create next artifact) |
| `/opsx-apply` | Implement tasks from a change |
| `/opsx-verify` | Verify implementation matches artifacts |
| `/opsx-archive` | Archive a completed change |
| `/opsx-sync` | Sync delta specs to main specs |
| `/opsx-bulk-archive` | Archive multiple changes at once |
| `/opsx-explore` | Explore mode – think through ideas, no implementation |
| `/opsx-onboard` | Guided first-time OpenSpec walkthrough |

## Prerequisites

- **OpenSpec CLI** must be installed and initialized in this project:
  ```bash
  npm install -g @fission-ai/openspec@latest
  openspec init   # if not already done
  ```
- Change data lives under `openspec/changes/` and `openspec/specs/` at the project root.

## Usage

In the OpenCode TUI, type `/` then the command name (e.g. `/opsx-new` or `/opsx-apply`). You can pass arguments where supported (e.g. change name). See each command’s description in the TUI or the corresponding file in `commands/`.
