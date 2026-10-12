# E2E Tests for MCP Server

SMM exposes an MCP server via `smm mcp start` (CLI / Electron / Docker). These
tests target the MCP Streamable HTTP endpoint with MCP Inspector — no Web UI.

## Prerequisites

```bash
pnpm install
```

`pnpm --filter e2e test:mcp` rebuilds the CLI binary before vitest (tests spawn
`apps/cli/dist` via `useMcpServer`). CI (`bun ci/run-mcp-e2e-test.ts`) expects
an already-built binary.

TMDB-dependent tests (`tmdb-*`, `scrape`, `get-job`) need network access and
`TMDB_HOST` / `TMDB_API_KEY` (optional `TMDB_HTTP_PROXY` as `http://` or
`https://` — socks5 is skipped because Bun fetch does not support it).

## Run

From `apps/e2e` (rebuilds CLI, then runs vitest):

```bash
pnpm run test:mcp
```

From repo root (uses existing `apps/cli/dist`):

```bash
pnpm e2e:mcp
# same as:
bun ci/run-mcp-e2e-test.ts
```

Single file:

```bash
bun ci/run-mcp-e2e-test.ts ./mcp/readme.test.ts
```

## Test files

| File | Covers |
|------|--------|
| `tools-list.test.ts` | `tools/list` exact name set |
| `start-stop-mcp-server-in-cli.test.ts` | `smm mcp start` / stop lifecycle |
| `get-app-context.test.ts` | `get-app-context` |
| `get-media-folders.test.ts` | `get-media-folders` |
| `is-folder-exist.test.ts` | `is-folder-exist` |
| `list-files.test.ts` | `list-files` |
| `get-media-metadata.test.ts` | `get-media-metadata` |
| `get-episode.test.ts` | `get-episode` |
| `get-episodes.test.ts` | `get-episodes` |
| `rename-folder.test.ts` | `rename-folder` |
| `scrape.test.ts` | `scrape` |
| `get-job.test.ts` | `get-job` |
| `tmdb-search.test.ts` | `tmdb-search` |
| `tmdb-get-movie.test.ts` | `tmdb-get-movie` |
| `tmdb-get-tv-show.test.ts` | `tmdb-get-tv-show` |
| `how-to-rename-episode-video-files.test.ts` | `how-to-rename-episode-video-files` |
| `how-to-recognize-episode-video-files.test.ts` | `how-to-recognize-episode-video-files` |
| `readme.test.ts` | `readme` |

## Out of scope (follow-up)

`tvdb-*`, `rename-episode-file`, `create-rename-episode-plan`,
`create-recognize-episode-plan`.

## Architecture

1. `mcpServer.ts` spawns `apps/cli/dist/cli[.exe] mcp start` with isolated temp dirs.
2. `mcpInspectorClient.ts` calls Inspector via `node <launcher>` (not `npx`).
3. `testSetup.ts` materializes `test/media` fixtures and seeds metadata cache.
