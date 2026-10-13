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
pnpm run test:mcp          # TARGET=dev — local MCP via pnpm mcp
pnpm run test:mcp:cli      # TARGET=cli — local MCP via apps/cli/dist binary
pnpm run test:mcp:remote   # TARGET=remote — attach to running SMM (see below)
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

### Remote (`test:mcp:remote`)

Use this target to validate the **user scenario**: SMM is already running (Docker
container or `smm web` with MCP started via UI / `smm mcp start`), and Vitest
talks to that process — it does **not** spawn `apps/cli/dist mcp start` for tool
suites. Tool calls go to `MCP_SERVER_ADDRESS`; container logs should show
`"source":"mcp"` access entries.

**Prerequisites**

1. A running SMM instance with HTTP and MCP ports published (defaults in the
   script match a typical Docker mapping):
   - HTTP: `30000` → `HTTP_SERVER_ADDRESS` (e.g. `http://127.0.0.1:30000`)
   - MCP: `30001` → `MCP_SERVER_ADDRESS` (e.g. `http://127.0.0.1:30001/mcp`)
2. Auth enabled with a token that matches `SMM_AUTH_TOKEN` in the script (default
   `ChangeMe123`; set the same value on the container, e.g.
   `-e SMM_AUTH_TOKEN=ChangeMe123`). HTTP and MCP lifecycle calls use
   `Authorization: Bearer …`.
3. Docker CLI on the host (same machine as the container) for media fixtures.

Example container (see `apps/docker/README.md`):

```bash
docker run --rm -p 30000:30000 -p 30001:30001 \
  -e SMM_AUTH_TOKEN=ChangeMe123 \
  --name smm \
  smm:latest
```

**Environment** (set by `test:mcp:remote` in `package.json`; override in the shell
as needed — child processes inherit unset vars):

| Variable | Role |
|----------|------|
| `TARGET` | `remote` |
| `HTTP_SERVER_ADDRESS` | Base URL for `/api/hello`, config/metadata APIs |
| `MCP_SERVER_ADDRESS` | Streamable HTTP MCP endpoint (include `/mcp` path) |
| `SMM_AUTH_TOKEN` | Bearer token for HTTP APIs |
| `SMM_DOCKER_CONTAINER` | Container name for `docker cp` / `docker exec` (default `smm` if unset) |

Custom container name:

```bash
SMM_DOCKER_CONTAINER=my-smm pnpm run test:mcp:remote
```

**Fixtures on remote**

- **Media files:** materialized on the host, then copied into the container at
  `/tmp/<runId>/…` via `docker cp`; MCP tool `path` arguments use those
  **container** paths. Teardown removes `/tmp/<runId>` in the container.
- **User config / metadata:** seeded over HTTP (Bearer), not by writing the
  container’s config dirs from the host.

**Skips:** `start-stop-mcp-server-in-cli.test.ts` is skipped when
`TARGET=remote` (CLI lifecycle only).

**Parallelism:** Remote runs share one SMM instance and HTTP-backed config. Vitest
may run test **files** in parallel; if you see flaky collisions on folders or
metadata, run with lower parallelism (e.g. `pnpm exec vitest run --config
vitest.mcp.config.ts --fileParallelism=false`) after the entrypoint has ensured
the server is up, or narrow to a single file.

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

| Target | MCP under test | Fixtures |
|--------|----------------|----------|
| `dev` / `cli` | Spawned local CLI (`mcp start`) | Host temp `USER_DATA_DIR` / `APP_DATA_DIR` |
| `remote` | Existing server at `MCP_SERVER_ADDRESS` | Media: `docker cp` → `/tmp/<runId>/…`; config/metadata: HTTP API |

1. `entrypoint.ts` waits for HTTP/MCP, starts remote MCP via HTTP if needed, then runs vitest.
2. `useMcpServer.ts` spawns locally for `dev`/`cli`, or attaches to `MCP_SERVER_ADDRESS` for `remote`.
3. `mcpServer.ts` — local spawn only.
4. `remoteDocker.ts` / `remoteFixtures.ts` — `docker cp` and HTTP seeding for remote.
5. `mcpInspectorClient.ts` calls Inspector via `node <launcher>` (not `npx`).
6. `testSetup.ts` materializes `test/media` fixtures and seeds metadata cache (local or via remote helpers).
