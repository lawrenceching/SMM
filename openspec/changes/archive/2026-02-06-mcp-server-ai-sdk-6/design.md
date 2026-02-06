## Context

SMM's CLI serves the UI and REST API. User config (including managed media folders) lives in `smm.json` and is read via `getUserConfig()` in `cli/src/utils/config.ts`; folders are `userConfig.folders` (platform-specific path strings). There is no MCP server today. The proposal adds an MCP server in the cli module using AI SDK 6, exposing one tool, `get-media-folders`, that returns those folder paths so MCP clients (e.g. AI assistants) can discover SMM-managed folders.

## Goals / Non-Goals

**Goals:**

- Run an MCP server from the cli module using AI SDK 6.
- Expose a single tool `get-media-folders` that returns the list of media folder paths from `userConfig.folders`.
- Reuse existing config: read via `getUserConfig()`; no new config files or schema changes.

**Non-Goals:**

- Exposing other SMM capabilities as MCP tools in this change.
- Changing the REST API or UI.
- Deploying to Vercel or any specific hosting; the server runs in the cli process (e.g. stdio or HTTP as chosen).

## Decisions

- **MCP server in cli**: The MCP server is implemented inside the cli module so it shares the same config and runtime as the existing server. Alternative: separate process or package; rejected to avoid config duplication and extra process management.

- **AI SDK 6 for MCP**: Use the AI SDK 6 MCP integration to define tools and run the server. Alternative: hand-roll MCP over stdio/HTTP; rejected to align with a standard, maintained API.

- **Single tool, get-media-folders**: First capability is one tool that returns `userConfig.folders`. More tools (e.g. list files, read metadata) can be added later under separate changes.

- **Tool implementation**: The tool handler calls `getUserConfig()` and returns the `folders` array (no transformation). Paths remain in the same format as stored (platform-specific). Alternative: normalize to POSIX; deferred to keep behavior identical to config and avoid breaking assumptions.

- **Transport**: Left to implementation (stdio, HTTP, or both). Design does not mandate one; choose based on how the cli is started and how MCP clients connect.

## Risks / Trade-offs

- **Config read on every call**: Each `get-media-folders` invocation reads config from disk. Acceptable for low call volume; if needed later, add caching with invalidation.
- **No auth in scope**: This change does not specify authentication for the MCP server. If the server is exposed on a network, auth should be addressed in a follow-up (e.g. local-only or token).
- **Dependency surface**: Adding AI SDK 6 and MCP packages increases cli dependencies; we accept this to use the standard MCP integration.
