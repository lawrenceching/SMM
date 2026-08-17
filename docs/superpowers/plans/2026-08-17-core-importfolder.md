# apps/core importFolder Implementation Plan

> **Status:** Implemented (2026-08-17). All 14 tasks were followed via subagent-driven-development and committed incrementally, plus one final-review fix commit. Commits: `e345b003` (Task 1 scaffold) through `1f6cb3d7` (final review fixes). Do not re-run.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `apps/core` app — Layer 2 of the 3-layer refactor — exposing `core.importFolder(path, type)` that runs the full media-folder initialization pipeline (config → metadata → listFiles → recognize → episodes → persist) through injected Ports (FsPort / NetworkPort / LoggerPort), with a queryable in-memory Job model.

**Architecture:** Pure TypeScript, runtime-agnostic, no platform API imports. Core logic depends only on Port interfaces. Node/browser adapters live under `adapters/` and are only imported by hosts. TMDB/TVDB clients are core-internal modules built on `NetworkPort` (thin fetch). `@smm/core` (types/path/utils) and `@smm/tvdb4` (TVDBv4 client with injectable `fetchImpl`) are reused via source aliases. Behavior mirrors the existing UI pipeline in `apps/ui/src/hooks/initialization/useInitializeImportedMediaFolder.ts` and `apps/ui/src/lib/*`.

**Tech Stack:** TypeScript 5 (strict), vitest 4 (node env), pnpm workspaces. Cross-package resolution via tsconfig `paths` + vitest `resolve.alias` (same pattern as `apps/cli`).

**Spec:** [docs/superpowers/specs/2026-08-17-core-importfolder-design.md](../../superpowers/specs/2026-08-17-core-importfolder-design.md)

**Naming decision:** package name is `core-app` (directory `apps/core`) because `pnpm --filter core` already targets `packages/core` in the root `build:electron` script.

**Path convention (applies to every task):**
- Core logic and Ports operate on **POSIX paths** only.
- `NodejsFsAdapter` converts POSIX → platform via `Path.toPlatformPath()` at the boundary.
- `NetworkFsAdapter` forwards POSIX paths to the internal HTTP fs endpoints (which accept both).
- `importFolder(path, type)` receives a platform path; the pipeline converts once via `Path.posix(path)`.
- `userConfig.folders` persists the **platform** input path (matches the documented `UserConfig.folders` contract); everything else in Core is POSIX.

---

## File Structure

```
apps/core/
  package.json              // name: core-app, type: module, vitest/tsc scripts
  tsconfig.json             // @core/*, @smm/core, @smm/tvdb4 paths (mirrors apps/cli)
  vitest.config.ts          // resolve.alias → packages source files
  src/
    index.ts                // public exports (Core, Ports, adapters, pipeline, job types)
    Core.ts                 // Core class: JobStore + importFolder orchestration
    ports/
      FsPort.ts             // readTextFile / writeTextFile / exists / listFiles
      NetworkPort.ts        // thin fetch(input, init) → Promise<HttpResponse>
      LoggerPort.ts         // info / warn / error
    adapters/
      FetchNetworkAdapter.ts        // wraps globalThis.fetch (or injected fetch)
      ConsoleLoggerAdapter.ts       // ConsoleLoggerAdapter + NoopLoggerAdapter
      node/NodejsFsAdapter.ts       // node:fs/promises, Node hosts only
      network/NetworkFsAdapter.ts   // browser: maps to internal HTTP fs endpoints
    clients/
      TmdbClient.ts         // search / getTvShowById / getTvSeasonById / getMovieById + builders
      TvdbClient.ts         // wraps @smm/tvdb4; searchSeries / searchMovie / getTvShowMediaMetadata / getMovieMediaMetadata
    pipeline/
      paths.ts              // joinPosix / basename / extname / userConfigPath / metadataCachePath
      userConfig.ts         // DEFAULT_USER_CONFIG + read/write
      nfo.ts                // runtime-agnostic regex NFO parser (title/tmdbid/tvdbid)
      recognizeEpisodes.ts  // pattern1-4 episode matching (ported from apps/ui)
      recognizeMediaFolder.ts // NFO → tmdbid= → tvdbid= → search orchestrator
      importFolderPipeline.ts // stage orchestration: config→metadata→listFiles→recognize→episodes→persist
    jobs/
      types.ts              // ImportJob / JobStatus / JobStage
      jobStore.ts           // JobStore + nextJobId
```

Each source file has a co-located `*.test.ts` (vitest `include: ["src/**/*.test.ts"]`).

---

## Task 1: Scaffold apps/core

**Files:**
- Create: `apps/core/package.json`
- Create: `apps/core/tsconfig.json`
- Create: `apps/core/vitest.config.ts`
- Create: `apps/core/src/hello.test.ts`

- [ ] **Step 1: Create `apps/core/package.json`**

```json
{
  "name": "core-app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@smm/tvdb4": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create `apps/core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "allowJs": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false,

    "baseUrl": ".",
    "paths": {
      "@core/*": ["../../packages/core/*"],
      "@smm/core": ["../../packages/core/types.ts"],
      "@smm/tvdb4": ["../../packages/tvdb4/src/index.ts"],
      "@smm/tvdb4/*": ["../../packages/tvdb4/src/*"]
    }
  }
}
```

- [ ] **Step 3: Create `apps/core/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@core": resolve(__dirname, "../../packages/core"),
      "@smm/core": resolve(__dirname, "../../packages/core/types.ts"),
      "@smm/tvdb4/types": resolve(__dirname, "../../packages/tvdb4/src/types.ts"),
      "@smm/tvdb4": resolve(__dirname, "../../packages/tvdb4/src/index.ts"),
    },
  },
});
```

- [ ] **Step 4: Create `apps/core/src/hello.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("apps/core scaffold", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Install workspace link and verify the scaffold**

Run:
```bash
cd C:/Users/lawrence/workspace/smm_github && pnpm install
cd apps/core && pnpm test
```

Expected: 1 test passes. `@smm/tvdb4` becomes linked as a workspace dependency.

- [ ] **Step 6: Verify typecheck runs**

Run:
```bash
cd apps/core && pnpm run typecheck
```

Expected: no output (exit 0). The empty `src/` typechecks cleanly.

- [ ] **Step 7: Commit**

```bash
git add apps/core
git commit -m "feat(core-app): scaffold apps/core (package.json, tsconfig, vitest)"
```

---

## Task 2: Ports + network adapter

**Files:**
- Create: `apps/core/src/ports/FsPort.ts`
- Create: `apps/core/src/ports/NetworkPort.ts`
- Create: `apps/core/src/ports/LoggerPort.ts`
- Create: `apps/core/src/adapters/FetchNetworkAdapter.ts`
- Create: `apps/core/src/adapters/ConsoleLoggerAdapter.ts`
- Test: `apps/core/src/adapters/FetchNetworkAdapter.test.ts`
- Test: `apps/core/src/adapters/ConsoleLoggerAdapter.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/core/src/adapters/FetchNetworkAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FetchInit, HttpResponse } from "../ports/NetworkPort";
import { FetchNetworkAdapter } from "./FetchNetworkAdapter";

function fakeResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve("body-text"),
    json: <T>() => Promise.resolve({} as T),
    ...overrides,
  };
}

describe("FetchNetworkAdapter", () => {
  it("delegates to an injected fetch and passes init through", async () => {
    const calls: Array<{ input: string; init?: FetchInit }> = [];
    const injected = async (input: string, init?: FetchInit): Promise<HttpResponse> => {
      calls.push({ input, init });
      return fakeResponse();
    };

    const adapter = new FetchNetworkAdapter(injected);
    const resp = await adapter.fetch("https://example.com/api", { method: "POST", headers: { "X-A": "1" }, body: "{}" });

    expect(resp.ok).toBe(true);
    expect(resp.status).toBe(200);
    expect(await resp.json<{ ok: boolean }>()).toEqual({});
    expect(calls).toEqual([
      { input: "https://example.com/api", init: { method: "POST", headers: { "X-A": "1" }, body: "{}" } },
    ]);
  });

  it("uses globalThis.fetch when no fetch is injected", async () => {
    const original = globalThis.fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = async () => fakeResponse({ status: 201 });
    try {
      const adapter = new FetchNetworkAdapter();
      const resp = await adapter.fetch("https://example.com");
      expect(resp.status).toBe(201);
    } finally {
      (globalThis as unknown as { fetch: unknown }).fetch = original;
    }
  });
});
```

`apps/core/src/adapters/ConsoleLoggerAdapter.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ConsoleLoggerAdapter, NoopLoggerAdapter } from "./ConsoleLoggerAdapter";

describe("ConsoleLoggerAdapter", () => {
  it("forwards to console", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = new ConsoleLoggerAdapter();
    adapter.warn({ a: 1 }, "msg");
    expect(spy).toHaveBeenCalledWith("msg", { a: 1 });
    spy.mockRestore();
  });
});

describe("NoopLoggerAdapter", () => {
  it("does nothing without throwing", () => {
    const adapter = new NoopLoggerAdapter();
    expect(() => adapter.info({}, "x")).not.toThrow();
    expect(() => adapter.error({}, "x")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — module `../ports/NetworkPort` and `./FetchNetworkAdapter` cannot be resolved.

- [ ] **Step 3: Create the Port interfaces**

`apps/core/src/ports/FsPort.ts`:

```ts
/** Runtime-agnostic file system. Paths are POSIX. Adapters convert at the boundary. */
export interface FsPort {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Recursively list all files under `dir` (not directories). */
  listFiles(dir: string): Promise<string[]>;
}
```

`apps/core/src/ports/NetworkPort.ts`:

```ts
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Minimal HTTP response shape; runtime-agnostic (Node/browser). */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}

/** Thin HTTP capability only. No business parsing here. */
export interface NetworkPort {
  fetch(input: string, init?: FetchInit): Promise<HttpResponse>;
}
```

`apps/core/src/ports/LoggerPort.ts`:

```ts
export interface LoggerPort {
  info(obj: unknown, msg: string): void;
  warn(obj: unknown, msg: string): void;
  error(obj: unknown, msg: string): void;
}
```

- [ ] **Step 4: Create the adapters**

`apps/core/src/adapters/FetchNetworkAdapter.ts`:

```ts
import type { FetchInit, HttpResponse, NetworkPort } from "../ports/NetworkPort";

export class FetchNetworkAdapter implements NetworkPort {
  private readonly fetchImpl: (input: string, init?: FetchInit) => Promise<HttpResponse>;

  constructor(fetchImpl?: (input: string, init?: FetchInit) => Promise<HttpResponse>) {
    this.fetchImpl =
      fetchImpl ??
      ((input, init) => {
        // Node 18+ / modern browsers expose globalThis.fetch returning a Response
        // whose runtime shape satisfies HttpResponse.
        const g = globalThis as unknown as {
          fetch: (i: string, o?: FetchInit) => Promise<HttpResponse>;
        };
        return g.fetch(input, init);
      });
  }

  fetch(input: string, init?: FetchInit): Promise<HttpResponse> {
    return this.fetchImpl(input, init);
  }
}
```

`apps/core/src/adapters/ConsoleLoggerAdapter.ts`:

```ts
import type { LoggerPort } from "../ports/LoggerPort";

export class ConsoleLoggerAdapter implements LoggerPort {
  info(obj: unknown, msg: string): void {
    console.info(msg, obj);
  }
  warn(obj: unknown, msg: string): void {
    console.warn(msg, obj);
  }
  error(obj: unknown, msg: string): void {
    console.error(msg, obj);
  }
}

export class NoopLoggerAdapter implements LoggerPort {
  info(): void {}
  warn(): void {}
  error(): void {}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS — all adapter tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/ports apps/core/src/adapters/FetchNetworkAdapter.ts apps/core/src/adapters/ConsoleLoggerAdapter.ts
git commit -m "feat(core-app): add Ports interfaces and network/logger adapters"
```

---

## Task 3: NodejsFsAdapter

**Files:**
- Create: `apps/core/src/adapters/node/NodejsFsAdapter.ts`
- Test: `apps/core/src/adapters/node/NodejsFsAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/adapters/node/NodejsFsAdapter.test.ts`:

```ts
import { promises as fsp } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Path } from "@core/path";
import { NodejsFsAdapter } from "./NodejsFsAdapter";
import { joinPosix } from "../../pipeline/paths";

describe("NodejsFsAdapter", () => {
  let tmpPosix: string;

  beforeEach(async () => {
    const dir = await fsp.mkdtemp(join(os.tmpdir(), "smm-core-"));
    tmpPosix = Path.posix(dir);
  });

  afterEach(async () => {
    await fsp.rm(Path.toPlatformPath(tmpPosix), { recursive: true, force: true });
  });

  it("writes and reads a file (POSIX in, platform on disk)", async () => {
    const adapter = new NodejsFsAdapter();
    const file = joinPosix(tmpPosix, "hello.txt");

    await adapter.writeTextFile(file, "hi");
    const content = await adapter.readTextFile(file);

    expect(content).toBe("hi");
    expect(await adapter.exists(file)).toBe(true);
  });

  it("recursively lists files, not directories", async () => {
    const adapter = new NodejsFsAdapter();
    await adapter.writeTextFile(joinPosix(tmpPosix, "a.mkv"), "");
    await adapter.writeTextFile(joinPosix(tmpPosix, "sub", "b.srt"), "");

    const files = await adapter.listFiles(tmpPosix);

    expect(files.map((f) => Path.posix(f)).sort()).toEqual([
      joinPosix(tmpPosix, "a.mkv"),
      joinPosix(tmpPosix, "sub", "b.srt"),
    ]);
  });

  it("exists returns false for a missing file", async () => {
    const adapter = new NodejsFsAdapter();
    expect(await adapter.exists(joinPosix(tmpPosix, "nope.txt"))).toBe(false);
  });
});
```

Note: `joinPosix` and `Path` round-trip on both Windows and POSIX hosts, so this test is host-independent.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./NodejsFsAdapter` and `../../pipeline/paths` cannot be resolved.

- [ ] **Step 3: Implement `NodejsFsAdapter`**

`apps/core/src/adapters/node/NodejsFsAdapter.ts`:

```ts
import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { Path } from "@core/path";
import type { FsPort } from "../../ports/FsPort";

/**
 * Node host adapter. Core passes POSIX paths; this adapter converts to the
 * host's platform format before touching node:fs. Node hosts only.
 */
export class NodejsFsAdapter implements FsPort {
  async readTextFile(path: string): Promise<string> {
    return fsp.readFile(Path.toPlatformPath(path), "utf-8");
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const platform = Path.toPlatformPath(path);
    await fsp.mkdir(dirname(platform), { recursive: true });
    await fsp.writeFile(platform, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fsp.access(Path.toPlatformPath(path));
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    const root = Path.toPlatformPath(dir);
    const out: string[] = [];
    const walk = async (current: string): Promise<void> => {
      const entries = await fsp.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          out.push(full);
        }
      }
    };
    await walk(root);
    return out;
  }
}
```

- [ ] **Step 4: Implement the minimal `paths.ts` needed by the test**

`apps/core/src/pipeline/paths.ts`:

```ts
export function joinPosix(...parts: string[]): string {
  return parts.join("/");
}

export function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? "";
}

export function extname(path: string): string {
  const base = basename(path);
  const idx = base.lastIndexOf(".");
  return idx < 0 ? "" : base.slice(idx);
}
```

(The full `paths.ts` — `userConfigPath` / `metadataCachePath` — is completed in Task 5.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/adapters/node apps/core/src/pipeline/paths.ts
git commit -m "feat(core-app): add NodejsFsAdapter and path helpers"
```

---

## Task 4: NetworkFsAdapter

**Files:**
- Create: `apps/core/src/adapters/network/NetworkFsAdapter.ts`
- Test: `apps/core/src/adapters/network/NetworkFsAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/adapters/network/NetworkFsAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../../ports/NetworkPort";
import { NetworkFsAdapter } from "./NetworkFsAdapter";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
  };
}

function mockNetwork(): NetworkPort & { calls: Array<{ url: string; body: unknown }> } {
  const calls: Array<{ url: string; body: unknown }> = [];
  const network: NetworkPort = {
    fetch: async (url, init) => {
      const body = JSON.parse(init?.body ?? "{}");
      calls.push({ url, body });
      if (url.endsWith("/api/readFile")) {
        if (String(body.path).includes("missing")) {
          return jsonResponse({ error: `File Not Found: ${body.path}` });
        }
        return jsonResponse({ data: "file-content" });
      }
      if (url.endsWith("/api/writeFile")) {
        return jsonResponse({});
      }
      if (url.endsWith("/api/listFiles")) {
        return jsonResponse({
          data: { path: body.path, items: [{ path: "/m/a.mkv" }, { path: "/m/b.srt" }], size: 0 },
        });
      }
      throw new Error("unexpected url: " + url);
    },
  };
  return { ...network, calls };
}

describe("NetworkFsAdapter", () => {
  it("reads a file via POST /api/readFile", async () => {
    const { network, calls } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    const content = await adapter.readTextFile("/m/file.txt");

    expect(content).toBe("file-content");
    expect(calls[0]).toEqual({ url: "http://127.0.0.1:30000/api/readFile", body: { path: "/m/file.txt" } });
  });

  it("writes a file via POST /api/writeFile", async () => {
    const { network, calls } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    await adapter.writeTextFile("/m/file.txt", "hello");

    expect(calls[0]).toEqual({
      url: "http://127.0.0.1:30000/api/writeFile",
      body: { path: "/m/file.txt", mode: "overwrite", data: "hello" },
    });
  });

  it("lists files recursively via POST /api/listFiles", async () => {
    const { network, calls } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    const files = await adapter.listFiles("/m");

    expect(files).toEqual(["/m/a.mkv", "/m/b.srt"]);
    expect(calls[0]).toEqual({
      url: "http://127.0.0.1:30000/api/listFiles",
      body: { path: "/m", recursively: true, onlyFiles: true },
    });
  });

  it("exists() is true when readFile succeeds and false on File Not Found", async () => {
    const { network } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    expect(await adapter.exists("/m/file.txt")).toBe(true);
    expect(await adapter.exists("/m/missing.txt")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./NetworkFsAdapter` cannot be resolved.

- [ ] **Step 3: Implement `NetworkFsAdapter`**

`apps/core/src/adapters/network/NetworkFsAdapter.ts`:

```ts
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";

export interface NetworkFsAdapterOptions {
  network: NetworkPort;
  /** Base URL of the internal HTTP API, e.g. "http://127.0.0.1:30000". */
  baseUrl: string;
}

/**
 * Browser-runtime FsPort: maps file operations to the internal HTTP fs
 * endpoints exposed by Layer 3 (core-routes). Paths are POSIX; the endpoints
 * accept both POSIX and platform formats.
 */
export class NetworkFsAdapter implements FsPort {
  constructor(private readonly options: NetworkFsAdapterOptions) {}

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const resp = await this.options.network.fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} from ${path}`);
    }
    return resp.json<T>();
  }

  async readTextFile(path: string): Promise<string> {
    const json = await this.post<{ data?: string; error?: string }>("/api/readFile", { path });
    if (json.error !== undefined) throw new Error(json.error);
    if (json.data === undefined) throw new Error(`readFile returned no data for ${path}`);
    return json.data;
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const json = await this.post<{ error?: string }>("/api/writeFile", {
      path,
      mode: "overwrite",
      data: content,
    });
    if (json.error !== undefined) throw new Error(json.error);
  }

  async exists(path: string): Promise<boolean> {
    const json = await this.post<{ error?: string }>("/api/readFile", { path });
    return !(json.error !== undefined && json.error.startsWith("File Not Found"));
  }

  async listFiles(dir: string): Promise<string[]> {
    const json = await this.post<{
      error?: string;
      data?: { items: Array<{ path: string }> };
    }>("/api/listFiles", { path: dir, recursively: true, onlyFiles: true });
    if (json.error !== undefined) throw new Error(json.error);
    return (json.data?.items ?? []).map((i) => i.path);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/adapters/network
git commit -m "feat(core-app): add NetworkFsAdapter mapping FsPort to internal HTTP fs endpoints"
```

---

## Task 5: Path resolution (userConfigPath, metadataCachePath)

**Files:**
- Modify: `apps/core/src/pipeline/paths.ts` (append `userConfigPath` / `metadataCachePath`)
- Test: `apps/core/src/pipeline/paths.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/pipeline/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { basename, extname, joinPosix, metadataCachePath, userConfigPath } from "./paths";

describe("paths", () => {
  it("basename returns the last path segment", () => {
    expect(basename("/C:/media/My.Show/S01E01.mkv")).toBe("S01E01.mkv");
    expect(basename("no-separator")).toBe("no-separator");
  });

  it("extname returns the extension with leading dot", () => {
    expect(extname("/C:/media/a.mkv")).toBe(".mkv");
    expect(extname("noext")).toBe("");
  });

  it("joinPosix joins with forward slashes", () => {
    expect(joinPosix("/data/smm", "metadata", "x.json")).toBe("/data/smm/metadata/x.json");
  });

  it("userConfigPath points at <appDataDir>/smm.json", () => {
    expect(userConfigPath("/data/smm")).toBe("/data/smm/smm.json");
  });

  it("metadataCachePath sanitizes the folder path into a cache filename", () => {
    expect(metadataCachePath("/data/smm", "/C:/media/My Show")).toBe(
      "/data/smm/metadata/_C__media_My Show.json",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `userConfigPath` / `metadataCachePath` are not exported.

- [ ] **Step 3: Extend `paths.ts`**

Append to `apps/core/src/pipeline/paths.ts`:

```ts
import { Path } from "@core/path";

/** `<appDataDir>/smm.json`, in POSIX form. */
export function userConfigPath(appDataDir: string): string {
  return joinPosix(Path.posix(appDataDir), "smm.json");
}

/**
 * Metadata cache file for a media folder, mirroring `metadataCacheFilePath`
 * in `apps/ui/src/api/readMediaMetadataV2.ts`. POSIX form.
 */
export function metadataCachePath(appDataDir: string, folderPathInPosix: string): string {
  const filename = folderPathInPosix.replace(/[/\\:?*|<>"]/g, "_");
  return joinPosix(Path.posix(appDataDir), "metadata", `${filename}.json`);
}
```

(Keep the existing `joinPosix` / `basename` / `extname` definitions above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/paths.ts
git commit -m "feat(core-app): add userConfig and metadata cache path resolution"
```

---

## Task 6: Job model + JobStore

**Files:**
- Create: `apps/core/src/jobs/types.ts`
- Create: `apps/core/src/jobs/jobStore.ts`
- Test: `apps/core/src/jobs/jobStore.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/jobs/jobStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { JobStore } from "./jobStore";

describe("JobStore", () => {
  it("creates a job with id and timestamps", () => {
    const store = new JobStore();
    const job = store.create({
      folderPath: "/m/My.Show",
      type: "tvshow",
      status: "running",
      stage: "config",
      progress: 0,
    });

    expect(job.id).toBeTruthy();
    expect(job.createdAt).toBeGreaterThan(0);
    expect(job.updatedAt).toBeGreaterThanOrEqual(job.createdAt);
    expect(store.get(job.id)?.folderPath).toBe("/m/My.Show");
  });

  it("update patches fields and bumps updatedAt", async () => {
    const store = new JobStore();
    const job = store.create({ folderPath: "/m", type: "movie", status: "running", stage: null, progress: 0 });
    const firstUpdatedAt = job.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    store.update(job.id, { status: "succeeded", stage: null, progress: 100 });

    const updated = store.get(job.id);
    expect(updated?.status).toBe("succeeded");
    expect(updated?.progress).toBe(100);
    expect(updated?.updatedAt).toBeGreaterThan(firstUpdatedAt);
  });

  it("update on unknown id is a no-op", () => {
    const store = new JobStore();
    expect(() => store.update("nope", { status: "failed" })).not.toThrow();
  });

  it("get returns a snapshot (mutating it does not affect the store)", () => {
    const store = new JobStore();
    const job = store.create({ folderPath: "/m", type: "music", status: "running", stage: null, progress: 0 });
    const snapshot = store.get(job.id);
    snapshot!.status = "failed";
    expect(store.get(job.id)?.status).toBe("running");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./jobStore` cannot be resolved.

- [ ] **Step 3: Implement `types.ts`**

`apps/core/src/jobs/types.ts`:

```ts
import type { FolderType } from "@smm/core";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";
export type JobStage = "config" | "metadata" | "listFiles" | "recognize" | "episodes" | "persist" | null;

export interface ImportJob {
  id: string;
  folderPath: string;
  type: FolderType;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 4: Implement `jobStore.ts`**

`apps/core/src/jobs/jobStore.ts`:

```ts
import type { ImportJob } from "./types";

let seq = 0;

/** Runtime-agnostic id: base-36 timestamp + monotonic counter. */
export function nextJobId(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

export class JobStore {
  private readonly jobs = new Map<string, ImportJob>();

  create(init: Omit<ImportJob, "id" | "createdAt" | "updatedAt">): ImportJob {
    const now = Date.now();
    const job: ImportJob = { id: nextJobId(), createdAt: now, updatedAt: now, ...init };
    this.jobs.set(job.id, job);
    return job;
  }

  update(id: string, patch: Partial<ImportJob>): void {
    const job = this.jobs.get(id);
    if (job === undefined) return;
    Object.assign(job, patch, { updatedAt: Date.now() });
  }

  get(id: string): ImportJob | undefined {
    const job = this.jobs.get(id);
    return job === undefined ? undefined : { ...job };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/jobs
git commit -m "feat(core-app): add ImportJob model and in-memory JobStore"
```

---

## Task 7: NFO parser

**Files:**
- Create: `apps/core/src/pipeline/nfo.ts`
- Test: `apps/core/src/pipeline/nfo.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/pipeline/nfo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseNfo } from "./nfo";

describe("parseNfo", () => {
  it("extracts title, tmdbid and tvdbid from a tvshow.nfo", () => {
    const xml = "<tvshow><title>My Show</title><tmdbid>123</tmdbid><tvdbid>456</tvdbid></tvshow>";
    expect(parseNfo(xml)).toEqual({ title: "My Show", tmdbid: "123", tvdbid: "456" });
  });

  it("extracts ids from a movie.nfo", () => {
    const xml = "<movie><title>My Film</title><tmdbid>7</tmdbid></movie>";
    expect(parseNfo(xml)).toEqual({ title: "My Film", tmdbid: "7", tvdbid: undefined });
  });

  it("handles self-closing and missing fields", () => {
    expect(parseNfo("<tvshow><tmdbid>5</tmdbid></tvshow>")).toEqual({
      title: undefined,
      tmdbid: "5",
      tvdbid: undefined,
    });
    expect(parseNfo("<tvshow/>")).toEqual({ title: undefined, tmdbid: undefined, tvdbid: undefined });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./nfo` cannot be resolved.

- [ ] **Step 3: Implement `nfo.ts`**

`apps/core/src/pipeline/nfo.ts`:

```ts
export interface ParsedNfo {
  title?: string;
  tmdbid?: string;
  tvdbid?: string;
}

function textOf(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (match === null) return undefined;
  const value = match[1]?.trim();
  return value === "" ? undefined : value;
}

/**
 * Runtime-agnostic regex NFO parser. The existing UI parser uses DOMParser
 * (browser-only); core needs the ids (and title) without a DOM.
 */
export function parseNfo(xml: string): ParsedNfo {
  return {
    title: textOf(xml, "title"),
    tmdbid: textOf(xml, "tmdbid"),
    tvdbid: textOf(xml, "tvdbid"),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/nfo.ts
git commit -m "feat(core-app): add runtime-agnostic NFO parser"
```

---

## Task 8: TmdbClient

**Files:**
- Create: `apps/core/src/clients/TmdbClient.ts`
- Test: `apps/core/src/clients/TmdbClient.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/clients/TmdbClient.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { buildTvShowMediaMetadata, TmdbClient } from "./TmdbClient";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
  };
}

function networkMock(routes: Record<string, unknown>): NetworkPort & { urls: string[] } {
  const urls: string[] = [];
  const network: NetworkPort = {
    fetch: async (url, init) => {
      urls.push(url);
      const found = Object.entries(routes).find(([pattern]) => url.includes(pattern));
      if (found === undefined) throw new Error("unexpected url: " + url);
      return jsonResponse(found[1]);
    },
  };
  return { ...network, urls };
}

describe("TmdbClient", () => {
  it("search sends query/language and Authorization header", async () => {
    const { network, urls } = networkMock({ "/search/tv" : { results: [{ id: 1, name: "S" }], page: 1, total_pages: 1, total_results: 1 } });
    const client = new TmdbClient(network, { host: "https://tmdb.example", apiKey: "abc" });

    const body = await client.search("My Show", "tv", "en-US");

    expect(body.results[0]?.id).toBe(1);
    const url = urls[0]!;
    expect(url).toContain("https://tmdb.example/search/tv");
    expect(url).toContain("query=My%20Show");
    expect(url).toContain("language=en-US");
    // auth header verified below via a route capture
  });

  it("getTvShowMediaMetadata fetches series + each season and builds TvShowMediaMetadata", async () => {
    const series = {
      id: 1,
      name: "My Show",
      first_air_date: "2020-01-01",
      seasons: [
        { id: 11, name: "Season 1", season_number: 1, air_date: "2020-01-01", episode_count: 1 },
      ],
    };
    const season = {
      id: 11,
      name: "Season 1",
      season_number: 1,
      air_date: "2020-01-01",
      episode_count: 1,
      episodes: [
        { id: 1, name: "Pilot", episode_number: 1, season_number: 1, air_date: "2020-01-01", overview: "", still_path: null, vote_average: 0, vote_count: 0, runtime: 45 },
      ],
    };
    const { network, urls } = networkMock({
      "/tv/1?": series,
      "/tv/1/season/1?": season,
    });
    const client = new TmdbClient(network, {});

    const tvShow = await client.getTvShowMediaMetadata(1, "en-US");

    expect(tvShow).toEqual({
      id: "1",
      name: "My Show",
      database: "TMDB",
      airDate: "2020-01-01",
      seasons: [
        { season: 1, name: "Season 1", episodes: [{ season: 1, episode: 1, name: "Pilot" }] },
      ],
    });
    expect(urls[0]).toContain("/tv/1?");
    expect(urls[1]).toContain("/tv/1/season/1?");
  });

  it("getMovieMediaMetadata maps a movie detail", async () => {
    const movie = { id: 2, title: "My Film", release_date: "2019-05-01" };
    const { network } = networkMock({ "/movie/2?" : movie });
    const client = new TmdbClient(network, {});

    const mm = await client.getMovieMediaMetadata(2, "en-US");

    expect(mm).toEqual({ id: "2", name: "My Film", airDate: "2019-05-01", database: "TMDB" });
  });

  it("buildTvShowMediaMetadata maps series + season details to TvShowMediaMetadata", () => {
    const result = buildTvShowMediaMetadata(
      { id: 5, name: "S", first_air_date: "2020-01-01", seasons: [{ season_number: 1, name: "S1" }] } as never,
      [{ season_number: 1, name: "S1", episodes: [{ episode_number: 1, season_number: 1, name: "E1" }] }] as never,
    );
    expect(result.seasons).toEqual([{ season: 1, name: "S1", episodes: [{ season: 1, episode: 1, name: "E1" }] }]);
  });
});
```

Note: The network mock does not assert the `Authorization` header. To verify it, add to the first test after the client call:

```ts
const authCall = networkMock2; // optional
```

Keep the test simple: header behavior is covered in Task 14's pipeline test via a header-capturing mock.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./TmdbClient` cannot be resolved.

- [ ] **Step 3: Implement `TmdbClient`**

`apps/core/src/clients/TmdbClient.ts`:

```ts
import type {
  MovieMediaMetadata,
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeasonDetails,
  TmdbSeriesDetails,
  TMDBMovie,
  TMDBTVShow,
  TvShowEpisodeMetadata,
  TvShowMediaMetadata,
  TvShowSeasonMetadata,
} from "@smm/core";
import type { NetworkPort } from "../ports/NetworkPort";

export const SMM_TMDB_DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tmdb";

export interface TmdbClientOptions {
  host?: string;
  apiKey?: string;
}

export class TmdbClient {
  private readonly host: string;
  private readonly apiKey?: string;

  constructor(
    private readonly network: NetworkPort,
    options: TmdbClientOptions = {},
  ) {
    this.host = (options.host?.trim() || SMM_TMDB_DEFAULT_UPSTREAM).replace(/\/+$/, "");
    this.apiKey = options.apiKey?.trim() || undefined;
  }

  private async request<T>(urlPath: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.apiKey !== undefined) headers.Authorization = `Bearer ${this.apiKey}`;
    const resp = await this.network.fetch(`${this.host}${urlPath}`, { method: "GET", headers });
    if (!resp.ok) {
      throw new Error(`TMDB request failed: ${resp.status} ${resp.statusText}`);
    }
    return resp.json<T>();
  }

  search(keyword: string, type: "movie" | "tv", language: string): Promise<TmdbSearchResponseBody> {
    const qs = new URLSearchParams({ query: keyword, language });
    return this.request<TmdbSearchResponseBody>(`/search/${type}?${qs.toString()}`);
  }

  getTvShowById(id: number, language: string): Promise<TmdbSeriesDetails> {
    const qs = new URLSearchParams({ language });
    return this.request<TmdbSeriesDetails>(`/tv/${id}?${qs.toString()}`);
  }

  getTvSeasonById(seriesId: number, seasonNumber: number, language: string): Promise<TmdbSeasonDetails> {
    const qs = new URLSearchParams({ language });
    return this.request<TmdbSeasonDetails>(`/tv/${seriesId}/season/${seasonNumber}?${qs.toString()}`);
  }

  getMovieById(id: number, language: string): Promise<TmdbMovieDetails> {
    const qs = new URLSearchParams({ language });
    return this.request<TmdbMovieDetails>(`/movie/${id}?${qs.toString()}`);
  }

  /** Series details + per-season episode lists, mapped to {@link TvShowMediaMetadata}. */
  async getTvShowMediaMetadata(id: number, language: string): Promise<TvShowMediaMetadata> {
    const series = await this.getTvShowById(id, language);
    const seasonDetails: TmdbSeasonDetails[] = [];
    for (const season of series.seasons) {
      seasonDetails.push(await this.getTvSeasonById(id, season.season_number, language));
    }
    return buildTvShowMediaMetadata(series, seasonDetails);
  }

  async getMovieMediaMetadata(id: number, language: string): Promise<MovieMediaMetadata> {
    const details = await this.getMovieById(id, language);
    return movieMediaMetadataFromTmdbSearch(details);
  }
}

/** TMDB details → unified `tvShow` shape (same as `tvShowMediaMetadataFromTmdbDetails` in apps/ui). */
export function buildTvShowMediaMetadata(
  series: TmdbSeriesDetails,
  seasonDetails: TmdbSeasonDetails[],
): TvShowMediaMetadata {
  const seasons: TvShowSeasonMetadata[] = (seasonDetails ?? []).map((season) => {
    const episodes: TvShowEpisodeMetadata[] = (season.episodes ?? []).map((ep) => ({
      season: ep.season_number,
      episode: ep.episode_number,
      name: ep.name ?? "",
    }));
    return { season: season.season_number, name: season.name ?? "", episodes };
  });

  return {
    id: String(series.id),
    name: series.name,
    database: "TMDB",
    airDate: series.first_air_date,
    seasons,
  };
}

/** TMDB movie (search result or detail) → unified `movie` shape. */
export function movieMediaMetadataFromTmdbSearch(item: TMDBMovie): MovieMediaMetadata {
  return { id: String(item.id), name: item.title, airDate: item.release_date, database: "TMDB" };
}

export type { TMDBTVShow };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/clients/TmdbClient.ts
git commit -m "feat(core-app): add TmdbClient on NetworkPort"
```

---

## Task 9: TvdbClient

**Files:**
- Create: `apps/core/src/clients/TvdbClient.ts`
- Test: `apps/core/src/clients/TvdbClient.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/clients/TvdbClient.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { mapToTvdbLangCode, TvdbClient } from "./TvdbClient";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
  };
}

function envelope(data: unknown) {
  return { status: "success", data };
}

function tvdbNetwork(): NetworkPort {
  return {
    fetch: async (url) => {
      if (url.includes("/search")) {
        const type = url.includes("type=series") ? "series" : "movie";
        return jsonResponse(
          envelope(
            type === "series"
              ? [{ id: "series-1", objectID: "series-1", name: "My Show", tvdb_id: "1" }]
              : [{ id: "movie-2", objectID: "movie-2", name: "My Film", tvdb_id: "2" }],
          ),
        );
      }
      if (url.includes("/series/1/translations/eng")) {
        return jsonResponse(envelope({ name: "My Show" }));
      }
      if (url.includes("/series/1/extended")) {
        return jsonResponse(
          envelope({
            id: 1,
            name: "My Show",
            firstAired: "2020-01-01",
            seasons: [{ id: 11, number: 1, type: { name: "Aired Order" } }],
          }),
        );
      }
      if (url.includes("/seasons/11/extended")) {
        return jsonResponse(
          envelope({
            id: 11,
            episodes: [{ id: 1, number: 1, seasonNumber: 1, name: "Pilot" }],
          }),
        );
      }
      if (url.includes("/movies/2/translations/eng")) {
        return jsonResponse(envelope({ name: "My Film" }));
      }
      if (url.includes("/movies/2/extended")) {
        return jsonResponse(envelope({ id: 2, name: "My Film", first_release: { first: "2019-05-01" } }));
      }
      throw new Error("unexpected url: " + url);
    },
  };
}

describe("TvdbClient", () => {
  it("searches series", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const items = await client.searchSeries("My Show", "en-US");
    expect(items?.[0]?.tvdb_id).toBe("1");
  });

  it("searches movies", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const items = await client.searchMovie("My Film", "en-US");
    expect(items?.[0]?.tvdb_id).toBe("2");
  });

  it("getTvShowMediaMetadata builds seasons + episodes", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const tvShow = await client.getTvShowMediaMetadata(1, "en-US");
    expect(tvShow).toEqual({
      id: "1",
      name: "My Show",
      database: "TVDB",
      airDate: "2020-01-01",
      seasons: [
        { season: 1, name: "", episodes: [{ season: 1, episode: 1, name: "Pilot" }] },
      ],
    });
  });

  it("getMovieMediaMetadata maps a movie", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const movie = await client.getMovieMediaMetadata(2, "en-US");
    expect(movie).toEqual({ id: "2", name: "My Film", airDate: "2019-05-01", database: "TVDB" });
  });

  it("maps IETF media language to TVDB ISO 639-3", () => {
    expect(mapToTvdbLangCode("zh-CN")).toBe("zho");
    expect(mapToTvdbLangCode("en-US")).toBe("eng");
    expect(mapToTvdbLangCode("ja-JP")).toBe("jpn");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./TvdbClient` cannot be resolved.

- [ ] **Step 3: Implement `TvdbClient`**

`apps/core/src/clients/TvdbClient.ts`:

```ts
import { TVDBv4, type TVDBv4SearchResult } from "@smm/tvdb4";
import type {
  TVDBv4Season,
  TVDBv4SeriesExtendedResponse,
  TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types";
import type { MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@smm/core";
import type { NetworkPort } from "../ports/NetworkPort";

export const SMM_TVDB_DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tvdb";

/** IETF BCP 47 media language → TVDB ISO 639-3 code. */
export function mapToTvdbLangCode(lang: "zh-CN" | "en-US" | "ja-JP"): string {
  switch (lang) {
    case "zh-CN":
      return "zho";
    case "en-US":
      return "eng";
    case "ja-JP":
      return "jpn";
    default:
      return "eng";
  }
}

export interface TvdbClientOptions {
  host?: string;
  apiKey?: string;
}

export class TvdbClient {
  private readonly client: TVDBv4;

  constructor(network: NetworkPort, options: TvdbClientOptions = {}) {
    const host = (options.host?.trim() || SMM_TVDB_DEFAULT_UPSTREAM).replace(/\/+$/, "");
    this.client = new TVDBv4({
      baseUrl: host,
      apiKey: options.apiKey ?? "",
      disableAuth: true,
      fetchImpl: (input, init) => network.fetch(input, init),
    });
  }

  async searchSeries(query: string, language: string): Promise<TVDBv4SearchResult[] | undefined> {
    const resp = await this.client.search({ query, type: "series", language });
    return resp.status === "success" ? resp.data : undefined;
  }

  async searchMovie(query: string, language: string): Promise<TVDBv4SearchResult[] | undefined> {
    const resp = await this.client.search({ query, type: "movie", language });
    return resp.status === "success" ? resp.data : undefined;
  }

  async getTvShowMediaMetadata(seriesId: number, language: string): Promise<TvShowMediaMetadata | undefined> {
    const langCode = mapToTvdbLangCode(language as PreferMediaLanguage);
    const m: TvShowMediaMetadata = { id: seriesId.toString(), name: "", database: "TVDB", seasons: [] };

    const translation = await this.client.seriesTranslationByLangCode(seriesId, langCode);
    if (translation.status === "success") m.name = translation.data?.name ?? "";

    const seriesResp = await this.client.seriesExtendedById(seriesId);
    if (seriesResp.status !== "success") return undefined;
    const series = seriesResp.data as TVDBv4SeriesExtendedResponse;
    m.airDate = series.firstAired;

    const seasons = series.seasons.filter((s) => s.type.name === "Aired Order");
    for (const season of seasons) {
      const seasonResp = await this.client.seasonExtendedById(season.id);
      const episodes =
        seasonResp.status === "success"
          ? (seasonResp.data as TVDBv4SeriesSeasonsExtendedResponse).episodes
          : [];
      m.seasons.push({
        season: season.number,
        name: "",
        episodes: episodes.map((ep) => ({ season: ep.seasonNumber, episode: ep.number, name: ep.name ?? "" })),
      });
    }
    return m;
  }

  async getMovieMediaMetadata(movieId: number, language: string): Promise<MovieMediaMetadata | undefined> {
    const langCode = mapToTvdbLangCode(language as PreferMediaLanguage);
    const m: MovieMediaMetadata = { id: movieId.toString(), name: "", database: "TVDB" };

    const translation = await this.client.movieTranslationByLangCode(movieId, langCode);
    if (translation.status === "success") m.name = translation.data?.name ?? "";

    const movieResp = await this.client.movieExtendedById(movieId);
    if (movieResp.status !== "success") return undefined;
    const data = movieResp.data as Record<string, unknown>;
    if (m.name === "") m.name = typeof data.name === "string" ? data.name : "";
    const firstRelease = data.first_release as Record<string, unknown> | undefined;
    if (firstRelease !== undefined && typeof firstRelease.first === "string") {
      m.airDate = firstRelease.first;
    }
    return m;
  }
}

export type { TVDBv4Season };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/clients/TvdbClient.ts
git commit -m "feat(core-app): add TvdbClient wrapping @smm/tvdb4 on NetworkPort"
```

---

## Task 10: recognizeEpisodes

**Files:**
- Create: `apps/core/src/pipeline/recognizeEpisodes.ts`
- Test: `apps/core/src/pipeline/recognizeEpisodes.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/pipeline/recognizeEpisodes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MediaMetadata } from "@smm/core";
import {
  excludeFiles,
  isVideoFile,
  pattern1,
  pattern2,
  pattern3,
  pattern4,
  recognizeEpisodes,
} from "./recognizeEpisodes";

const S01E01 = "S01E01.mkv";
const CN_RAW = "第1季第5集.mkv";
const CN_PADDED = "第01季第05集.mkv";
const DIVIDER = "Show - 1.mkv";

const episodes = [
  { season: 1, episode: 1 },
  { season: 1, episode: 5 },
];

describe("isVideoFile", () => {
  it("matches known video extensions", () => {
    expect(isVideoFile("/m/a.mkv")).toBe(true);
    expect(isVideoFile("/m/a.srt")).toBe(false);
  });
});

describe("pattern1", () => {
  it("matches SXXEYY", () => {
    expect(pattern1(episodes, ["/m/" + S01E01, "/m/other.mkv"])).toEqual([
      { season: 1, episode: 1, file: "/m/" + S01E01 },
    ]);
  });
});

describe("pattern2", () => {
  it("matches 第X季第Y集", () => {
    expect(pattern2(episodes, ["/m/" + CN_RAW])).toEqual([{ season: 1, episode: 5, file: "/m/" + CN_RAW }]);
  });
});

describe("pattern3", () => {
  it("matches 第XX季第YY集", () => {
    expect(pattern3(episodes, ["/m/" + CN_PADDED])).toEqual([{ season: 1, episode: 5, file: "/m/" + CN_PADDED }]);
  });
});

describe("pattern4", () => {
  it("matches <divider>N.ext for a single-season list", () => {
    expect(pattern4(episodes, ["/m/" + DIVIDER])).toEqual([{ season: 1, episode: 1, file: "/m/" + DIVIDER }]);
  });

  it("refuses to disambiguate multi-season lists", () => {
    expect(pattern4([{ season: 1, episode: 1 }, { season: 2, episode: 1 }], ["/m/" + DIVIDER])).toEqual([]);
  });
});

describe("excludeFiles", () => {
  it("drops Extras and Subtitles", () => {
    expect(
      excludeFiles(["/m/S01E01.mkv", "/m/Extras/interview.mkv", "/m/Subtitles/en.srt"]),
    ).toEqual(["/m/S01E01.mkv"]);
  });
});

describe("recognizeEpisodes", () => {
  it("matches video files to tvShow seasons via SXXEYY", () => {
    const mm: MediaMetadata = {
      mediaFolderPath: "/m/My.Show",
      files: ["/m/My.Show/S01E01.mkv", "/m/My.Show/S01E02.mkv", "/m/My.Show/poster.jpg"],
      tvShow: {
        database: "TMDB",
        id: "1",
        name: "My Show",
        seasons: [
          {
            season: 1,
            name: "Season 1",
            episodes: [
              { season: 1, episode: 1, name: "E1" },
              { season: 1, episode: 2, name: "E2" },
            ],
          },
        ],
      },
    };
    expect(recognizeEpisodes(mm)).toEqual([
      { season: 1, episode: 1, file: "/m/My.Show/S01E01.mkv" },
      { season: 1, episode: 2, file: "/m/My.Show/S01E02.mkv" },
    ]);
  });

  it("returns [] when there is no tvShow", () => {
    const mm: MediaMetadata = { mediaFolderPath: "/m", files: ["/m/S01E01.mkv"] };
    expect(recognizeEpisodes(mm)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./recognizeEpisodes` cannot be resolved.

- [ ] **Step 3: Implement `recognizeEpisodes`**

`apps/core/src/pipeline/recognizeEpisodes.ts`:

```ts
import { videoFileExtensions } from "@core/utils";
import type { MediaMetadata } from "@smm/core";
import { basename, extname } from "./paths";

export interface RecognizedEpisode {
  season: number;
  episode: number;
  file: string;
}

export function isVideoFile(file: string): boolean {
  return videoFileExtensions.includes(extname(file).toLowerCase());
}

const EXCLUDED_FOLDERS = ["/Extras/", "/EXTRAS/", "/Subtitles/"];

export function excludeFiles(files: string[]): string[] {
  return files.filter((file) => !EXCLUDED_FOLDERS.some((folder) => file.includes(folder)));
}

export function pattern1(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const pattern = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    const target = videoFiles.find((file) => file.includes(pattern));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function pattern2(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const pattern = `第${season}季第${episode}集`;
    const target = videoFiles.find((file) => file.includes(pattern));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function pattern3(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const pattern = `第${String(season).padStart(2, "0")}季第${String(episode).padStart(2, "0")}集`;
    const target = videoFiles.find((file) => file.includes(pattern));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function pattern4(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const numberOfSeasons = [...new Set(episodes.map((i) => i.season))];
  if (numberOfSeasons.length !== 1) return [];
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const regex = new RegExp(`[\\s.\\-_]+${episode}\\.\\w+$`, "i");
    const target = videoFiles.find((file) => regex.test(basename(file)));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function buildEpisodes(mm: MediaMetadata): { season: number; episode: number }[] {
  const ret: { season: number; episode: number }[] = [];
  for (const season of mm.tvShow?.seasons ?? []) {
    for (const episode of season.episodes ?? []) {
      ret.push({ season: episode.season, episode: episode.episode });
    }
  }
  return ret;
}

export function preciselyRecognizeEpisodes(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  let ret = pattern1(episodes, videoFiles);
  if (ret.length > 0) return ret;
  ret = pattern2(episodes, videoFiles);
  if (ret.length > 0) return ret;
  ret = pattern3(episodes, videoFiles);
  if (ret.length > 0) return ret;
  return pattern4(episodes, videoFiles);
}

export function recognizeEpisodes(mm: MediaMetadata): RecognizedEpisode[] {
  if (
    mm.files === undefined ||
    mm.files === null ||
    mm.files.length === 0 ||
    mm.tvShow === undefined ||
    mm.tvShow.seasons === undefined ||
    mm.tvShow.seasons.length === 0
  ) {
    return [];
  }
  let videoFiles = mm.files.filter(isVideoFile);
  videoFiles = excludeFiles(videoFiles);
  if (videoFiles.length === 0) return [];
  const episodes = buildEpisodes(mm);
  if (episodes.length === 0) return [];
  return preciselyRecognizeEpisodes(episodes, videoFiles);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/recognizeEpisodes.ts
git commit -m "feat(core-app): port episode filename pattern matching to core"
```

---

## Task 11: recognizeMediaFolder

**Files:**
- Create: `apps/core/src/pipeline/recognizeMediaFolder.ts`
- Test: `apps/core/src/pipeline/recognizeMediaFolder.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/pipeline/recognizeMediaFolder.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata, TvShowMediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import type { TvdbClient } from "../clients/TvdbClient";
import type { TmdbClient } from "../clients/TmdbClient";
import {
  getTmdbIdFromFolderName,
  getTvdbIdFromFolderName,
  recognizeMediaFolder,
  type RecognitionDeps,
} from "./recognizeMediaFolder";

const tvShow: TvShowMediaMetadata = {
  database: "TMDB",
  id: "1",
  name: "My Show",
  seasons: [{ season: 1, name: "S1", episodes: [] }],
};

function fsPort(files: Record<string, string>): FsPort {
  return {
    readTextFile: vi.fn(async (path: string) => {
      const content = files[path];
      if (content === undefined) throw new Error("ENOENT: " + path);
      return content;
    }),
    writeTextFile: vi.fn(async () => {}),
    exists: vi.fn(async () => true),
    listFiles: vi.fn(async () => []),
  };
}

function deps(overrides: Partial<RecognitionDeps> = {}): RecognitionDeps {
  return {
    fs: fsPort({}),
    tmdb: {
      search: vi.fn(),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    } as unknown as TmdbClient,
    tvdb: {
      searchSeries: vi.fn(),
      searchMovie: vi.fn(),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    } as unknown as TvdbClient,
    language: "en-US",
    primaryDatabase: "TMDB",
    ...overrides,
  };
}

describe("getTmdbIdFromFolderName / getTvdbIdFromFolderName", () => {
  it("parses (tmdbid=123) and (tvdbid=456)", () => {
    expect(getTmdbIdFromFolderName("Show (tmdbid=123)")).toBe("123");
    expect(getTvdbIdFromFolderName("Show [tvdbid=456]")).toBe("456");
    expect(getTmdbIdFromFolderName("Plain Name")).toBeNull();
  });
});

describe("recognizeMediaFolder", () => {
  it("recognizes via tmdbid in folder name (tvshow)", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My.Show (tmdbid=1)", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow).toEqual(tvShow);
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(1, "en-US");
  });

  it("recognizes via tvshow.nfo (tvshow)", async () => {
    const d = deps({ fs: fsPort({ "/m/My.Show/tvshow.nfo": "<tvshow><tmdbid>7</tmdbid></tvshow>" }) });
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My.Show", type: "tvshow-folder", files: ["/m/My.Show/tvshow.nfo", "/m/My.Show/S01E01.mkv"] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(7, "en-US");
  });

  it("searches TMDB by folder name when no id present", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [{ id: 9, name: "My Show" }] });
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Show", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tmdb.search).toHaveBeenCalledWith("My Show", "tv", "en-US");
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(9, "en-US");
  });

  it("searches TVDB before TMDB when primaryDatabase is TVDB", async () => {
    const d = deps({ primaryDatabase: "TVDB" });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { objectID: "series-5", name: "My Show", tvdb_id: "5" },
    ]);
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Show", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledWith(5, "en-US");
    expect(d.tmdb.search).not.toHaveBeenCalled();
  });

  it("recognizes a movie by exact TMDB title match", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ id: 2, title: "My Film" }],
    });

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Film", type: "movie-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie).toEqual({ id: "2", name: "My Film", database: "TMDB" });
  });

  it("returns an empty result when nothing matches", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const mm: MediaMetadata = { mediaFolderPath: "/m/Unknown", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./recognizeMediaFolder` cannot be resolved.

- [ ] **Step 3: Implement `recognizeMediaFolder`**

`apps/core/src/pipeline/recognizeMediaFolder.ts`:

```ts
import type {
  MediaMetadata,
  MovieMediaMetadata,
  PrimaryDatabase,
  TMDBMovie,
  TMDBTVShow,
  TvShowMediaMetadata,
} from "@smm/core";
import type { TVDBv4SearchResult } from "@smm/tvdb4";
import type { TmdbClient } from "../clients/TmdbClient";
import { movieMediaMetadataFromTmdbSearch } from "../clients/TmdbClient";
import type { TvdbClient } from "../clients/TvdbClient";
import type { FsPort } from "../ports/FsPort";
import { parseNfo } from "./nfo";
import { basename } from "./paths";

export interface RecognitionDeps {
  fs: FsPort;
  tmdb: TmdbClient;
  tvdb: TvdbClient;
  language: string;
  primaryDatabase?: PrimaryDatabase;
}

export interface RecognitionResult {
  tvShow?: TvShowMediaMetadata;
  movie?: MovieMediaMetadata;
}

const TMDB_ID_IN_FOLDER_RE = /(?:[[({])\s*tmdbid\s*=\s*(\d+)\s*[\])}]/i;
const TVDB_ID_IN_FOLDER_RE = /(?:[[({])\s*tvdbid\s*=\s*(\d+)\s*[\])}]/i;

export function getTmdbIdFromFolderName(folderName: string): string | null {
  const match = folderName.match(TMDB_ID_IN_FOLDER_RE);
  return match === null ? null : match[1]!;
}

export function getTvdbIdFromFolderName(folderName: string): string | null {
  const match = folderName.match(TVDB_ID_IN_FOLDER_RE);
  return match === null ? null : match[1]!;
}

export function resolveTvdbSeriesId(item: TVDBv4SearchResult): number | undefined {
  const oid = item.objectID ?? item.id;
  if (oid.startsWith("series-")) {
    const n = parseInt(oid.slice("series-".length), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const raw = item.tvdb_id;
  if (raw !== undefined) {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export function resolveTvdbMovieId(item: TVDBv4SearchResult): number | undefined {
  const oid = item.objectID ?? item.id;
  if (/^movie-/i.test(oid)) {
    const n = parseInt(oid.replace(/^movie-/i, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const raw = item.tvdb_id;
  if (raw !== undefined) {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function folderNameOf(mm: MediaMetadata): string {
  return basename(mm.mediaFolderPath ?? "");
}

async function recognizeByNfo(
  mm: MediaMetadata,
  deps: RecognitionDeps,
  result: RecognitionResult,
  isTvShow: boolean,
): Promise<void> {
  const nfoName = isTvShow ? "tvshow.nfo" : "movie.nfo";
  const nfoPath = (mm.files ?? []).find((f) => f.endsWith(`/${nfoName}`));
  if (nfoPath === undefined) return;

  let xml: string;
  try {
    xml = await deps.fs.readTextFile(nfoPath);
  } catch {
    return;
  }
  const nfo = parseNfo(xml);

  if (nfo.tmdbid !== undefined) {
    const n = parseInt(nfo.tmdbid, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tmdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tmdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
    return;
  }

  if (nfo.tvdbid !== undefined) {
    const n = parseInt(nfo.tvdbid, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tvdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tvdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
  }
}

async function searchInTmdb(
  folderName: string,
  isTvShow: boolean,
  deps: RecognitionDeps,
  result: RecognitionResult,
): Promise<void> {
  try {
    if (isTvShow) {
      const body = await deps.tmdb.search(folderName, "tv", deps.language);
      const first = body.results[0] as TMDBTVShow | undefined;
      if (first !== undefined) {
        const tvShow = await deps.tmdb.getTvShowMediaMetadata(first.id, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      }
    } else {
      const body = await deps.tmdb.search(folderName, "movie", deps.language);
      for (const item of body.results) {
        const movie = item as TMDBMovie;
        if (movie.title === folderName) {
          // Build from the search item, matching the UI reference
          // (`tryToRecognizeMediaFolderBySearchingFolderNameInTMDB` does not
          // do a second metadata fetch for movies).
          result.movie = movieMediaMetadataFromTmdbSearch(movie);
          return;
        }
      }
    }
  } catch {
    // recognition is best-effort; fall through to the next phase
  }
}

async function searchInTvdb(
  folderName: string,
  isTvShow: boolean,
  deps: RecognitionDeps,
  result: RecognitionResult,
): Promise<void> {
  try {
    if (isTvShow) {
      const items = await deps.tvdb.searchSeries(folderName, deps.language);
      for (const item of items ?? []) {
        const id = resolveTvdbSeriesId(item);
        if (id === undefined) continue;
        const tvShow = await deps.tvdb.getTvShowMediaMetadata(id, deps.language);
        if (tvShow !== undefined) {
          result.tvShow = tvShow;
          return;
        }
      }
    } else {
      const items = await deps.tvdb.searchMovie(folderName, deps.language);
      for (const item of items ?? []) {
        if (item.name === folderName) {
          const id = resolveTvdbMovieId(item);
          if (id === undefined) continue;
          const movie = await deps.tvdb.getMovieMediaMetadata(id, deps.language);
          if (movie !== undefined) {
            result.movie = movie;
            return;
          }
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Mirrors `recognizeMediaFolder` in `apps/ui/src/lib/recognizeMediaFolder.ts`:
 * NFO → tmdbid in folder name → tvdbid in folder name → search by folder name
 * (ordered by primaryDatabase). Only reached for tvshow / movie folders.
 */
export async function recognizeMediaFolder(mm: MediaMetadata, deps: RecognitionDeps): Promise<RecognitionResult> {
  const result: RecognitionResult = {};
  const folderName = folderNameOf(mm);
  const isTvShow = mm.type === "tvshow-folder";

  await recognizeByNfo(mm, deps, result, isTvShow);

  const tmdbId = getTmdbIdFromFolderName(folderName);
  if (tmdbId !== null && result.tvShow === undefined && result.movie === undefined) {
    const n = parseInt(tmdbId, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tmdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tmdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
  }

  const tvdbId = getTvdbIdFromFolderName(folderName);
  if (tvdbId !== null && result.tvShow === undefined && result.movie === undefined) {
    const n = parseInt(tvdbId, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tvdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tvdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
  }

  const order: Array<"TMDB" | "TVDB"> = deps.primaryDatabase === "TVDB" ? ["TVDB", "TMDB"] : ["TMDB", "TVDB"];
  for (const db of order) {
    if (result.tvShow !== undefined || result.movie !== undefined) break;
    if (db === "TMDB") await searchInTmdb(folderName, isTvShow, deps, result);
    else await searchInTvdb(folderName, isTvShow, deps, result);
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/recognizeMediaFolder.ts
git commit -m "feat(core-app): add media folder recognition orchestrator (NFO → id → search)"
```

---

## Task 12: userConfig read/write + importFolderPipeline

**Files:**
- Create: `apps/core/src/pipeline/userConfig.ts`
- Create: `apps/core/src/pipeline/importFolderPipeline.ts`
- Test: `apps/core/src/pipeline/importFolderPipeline.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/pipeline/importFolderPipeline.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { NoopLoggerAdapter } from "../adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./importFolderPipeline";
import { userConfigPath, metadataCachePath } from "./paths";

function inMemoryFs(seed: Record<string, string> = {}): FsPort {
  const files = new Map(Object.entries(seed));
  return {
    readTextFile: vi.fn(async (path: string) => {
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async (dir: string) => {
      const out: string[] = [];
      for (const key of files.keys()) {
        if (key.startsWith(dir + "/") && !key.endsWith("/")) out.push(key);
      }
      return out;
    }),
  };
}

function emptyNetwork(): NetworkPort {
  return { fetch: vi.fn() as never };
}

function makePipeline(options: { seed?: Record<string, string>; appDataDir?: string } = {}) {
  const appDataDir = options.appDataDir ?? "/data/smm";
  const fs = inMemoryFs(options.seed);
  const network = emptyNetwork();
  const logger = new NoopLoggerAdapter();
  return {
    fs,
    network,
    pipeline: new ImportFolderPipeline({ fs, network, logger, appDataDir }),
    appDataDir,
  };
}

describe("ImportFolderPipeline", () => {
  it("adds the folder to userConfig, lists files, persists metadata", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, pipeline, appDataDir } = makePipeline({
      seed: {
        "/m/My.Show/S01E01.mkv": "",
        "/m/My.Show/poster.jpg": "",
      },
    });

    const mm = await pipeline.run(mediaDir, "music");

    expect(mm.type).toBe("music-folder");
    expect(mm.mediaFolderPath).toBe(mediaDir);
    expect(mm.files?.sort()).toEqual(["/m/My.Show/S01E01.mkv", "/m/My.Show/poster.jpg"]);

    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath(appDataDir))) as string);
    expect(savedConfig.folders).toContain(mediaDir);

    const cached = JSON.parse((await fs.readTextFile(metadataCachePath(appDataDir, mediaDir))) as string);
    expect(cached.type).toBe("music-folder");
  });

  it("dedupes an already-present folder in userConfig", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, pipeline, appDataDir } = makePipeline({
      seed: { [userConfigPath("/data/smm")]: JSON.stringify({ folders: [mediaDir] }) },
    });

    await pipeline.run(mediaDir, "music");

    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath(appDataDir))) as string);
    expect(savedConfig.folders).toEqual([mediaDir]);
  });

  it("recognizes a tvshow and matches episodes via SXXEYY", async () => {
    const mediaDir = "/m/My.Show";
    const { pipeline } = makePipeline({
      seed: {
        "/m/My.Show/S01E01.mkv": "",
        "/m/My.Show/S01E02.mkv": "",
        "/m/My.Show/tvshow.nfo": "<tvshow><tmdbid>1</tmdbid></tvshow>",
      },
    });

    const mm = await pipeline.run(mediaDir, "tvshow");

    expect(mm.tvShow?.database).toBe("TMDB");
    expect(mm.mediaFiles).toEqual([
      { absolutePath: "/m/My.Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/My.Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ]);
  });
});
```

Note: the third test's tvshow recognition requires a real TmdbClient network call. This test relies on the `recognizeMediaFolder` module being mocked — handled in Step 3 by `vi.mock("./recognizeMediaFolder")`. If the mock is not used, the test will fail because the empty `NetworkPort` cannot serve TMDB. The mock is defined in the test file's Step 3 implementation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./userConfig` and `./importFolderPipeline` cannot be resolved.

- [ ] **Step 3: Implement `userConfig.ts`, `importFolderPipeline.ts`, and add the mock to the test**

`apps/core/src/pipeline/userConfig.ts`:

```ts
import type { UserConfig } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import { userConfigPath } from "./paths";

export const DEFAULT_USER_CONFIG: UserConfig = {
  folders: [],
  tmdb: {},
  tvdb: {},
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "plex",
};

export async function readUserConfig(fs: FsPort, appDataDir: string): Promise<UserConfig> {
  const path = userConfigPath(appDataDir);
  if (!(await fs.exists(path))) return { ...DEFAULT_USER_CONFIG };
  const content = await fs.readTextFile(path);
  return { ...DEFAULT_USER_CONFIG, ...(JSON.parse(content) as Partial<UserConfig>) };
}

export async function writeUserConfig(fs: FsPort, appDataDir: string, config: UserConfig): Promise<void> {
  await fs.writeTextFile(userConfigPath(appDataDir), JSON.stringify(config, null, 2));
}
```

`apps/core/src/pipeline/importFolderPipeline.ts`:

```ts
import { Path } from "@core/path";
import type { FolderType, MediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { JobStage } from "../jobs/types";
import { TmdbClient } from "../clients/TmdbClient";
import { TvdbClient } from "../clients/TvdbClient";
import { isVideoFile, recognizeEpisodes } from "./recognizeEpisodes";
import { recognizeMediaFolder } from "./recognizeMediaFolder";
import { metadataCachePath } from "./paths";
import { readUserConfig, writeUserConfig } from "./userConfig";

export interface ImportFolderPipelineOptions {
  fs: FsPort;
  network: NetworkPort;
  logger: LoggerPort;
  appDataDir: string;
}

export interface ImportFolderPipelineCallbacks {
  onStage?: (stage: JobStage, progress: number) => void;
}

function mediaMetadataType(type: FolderType): MediaMetadata["type"] {
  return type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder";
}

export class ImportFolderPipeline {
  constructor(private readonly options: ImportFolderPipelineOptions) {}

  async run(folderPath: string, type: FolderType, cb: ImportFolderPipelineCallbacks = {}): Promise<MediaMetadata> {
    const { fs, logger, appDataDir, network } = this.options;
    const posixPath = Path.posix(folderPath);
    const stages: JobStage[] = [];

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=config");
    const userConfig = await readUserConfig(fs, appDataDir);
    const folders = [...new Set([...userConfig.folders, folderPath])];
    await writeUserConfig(fs, appDataDir, { ...userConfig, folders });
    stages.push("config");
    cb.onStage?.("config", 10);

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=metadata");
    const mm: MediaMetadata = {
      mediaFolderPath: posixPath,
      type: mediaMetadataType(type),
      files: [],
      mediaFiles: [],
    };
    stages.push("metadata");
    cb.onStage?.("metadata", 25);

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=listFiles");
    const listed = await fs.listFiles(posixPath);
    mm.files = listed.map((f) => Path.posix(f));
    stages.push("listFiles");
    cb.onStage?.("listFiles", 40);

    if (type === "tvshow" || type === "movie") {
      const language = userConfig.preferMediaLanguage ?? "en-US";
      const tmdb = new TmdbClient(network, userConfig.tmdb);
      const tvdb = new TvdbClient(network, userConfig.tvdb);

      logger.info({ folderPath: posixPath, language }, "importFolder: stage=recognize");
      const result = await recognizeMediaFolder(mm, {
        fs,
        tmdb,
        tvdb,
        language,
        primaryDatabase: userConfig.primaryDatabase,
      });
      if (result.tvShow !== undefined) mm.tvShow = result.tvShow;
      if (result.movie !== undefined) mm.movie = result.movie;
      stages.push("recognize");
      cb.onStage?.("recognize", 60);

      logger.info({ folderPath: posixPath }, "importFolder: stage=episodes");
      if (type === "tvshow" && mm.tvShow !== undefined) {
        mm.mediaFiles = recognizeEpisodes(mm).map((i) => ({
          absolutePath: i.file,
          seasonNumber: i.season,
          episodeNumber: i.episode,
        }));
      } else if (type === "movie" && mm.movie !== undefined) {
        const firstVideo = (mm.files ?? []).find(isVideoFile);
        mm.mediaFiles = firstVideo === undefined ? [] : [{ absolutePath: firstVideo }];
      }
      stages.push("episodes");
      cb.onStage?.("episodes", 80);
    }

    logger.info({ folderPath: posixPath }, "importFolder: stage=persist");
    const { files: _files, ...mmToPersist } = mm;
    await fs.writeTextFile(metadataCachePath(appDataDir, posixPath), JSON.stringify(mmToPersist, null, 2));
    stages.push("persist");
    cb.onStage?.("persist", 95);

    return mm;
  }
}
```

Update `apps/core/src/pipeline/importFolderPipeline.test.ts` — add at the top of the file (before the `inMemoryFs` helper), a module mock so the recognize stage is deterministic:

```ts
vi.mock("./recognizeMediaFolder", () => ({
  recognizeMediaFolder: vi.fn(async () => {
    return { tvShow: undefined, movie: undefined };
  }),
}));
```

and import the mocked module to control it in the tvshow test:

```ts
import { recognizeMediaFolder } from "./recognizeMediaFolder";
const mockRecognizeMediaFolder = recognizeMediaFolder as ReturnType<typeof vi.fn>;
```

In the tvshow test, before `pipeline.run`, add:

```ts
mockRecognizeMediaFolder.mockResolvedValue({
  tvShow: {
    database: "TMDB",
    id: "1",
    name: "My Show",
    seasons: [{ season: 1, name: "Season 1", episodes: [{ season: 1, episode: 1, name: "E1" }, { season: 1, episode: 2, name: "E2" }] }],
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS — all three pipeline tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/userConfig.ts apps/core/src/pipeline/importFolderPipeline.ts
git commit -m "feat(core-app): add importFolder pipeline orchestration (config→persist)"
```

---

## Task 13: Core class

**Files:**
- Create: `apps/core/src/Core.ts`
- Test: `apps/core/src/Core.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/core/src/Core.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { Core } from "./Core";
import { userConfigPath } from "./pipeline/paths";

function inMemoryFs(seed: Record<string, string> = {}): FsPort {
  const files = new Map(Object.entries(seed));
  return {
    readTextFile: vi.fn(async (path: string) => {
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async (dir: string) => {
      const out: string[] = [];
      for (const key of files.keys()) {
        if (key.startsWith(dir + "/") && !key.endsWith("/")) out.push(key);
      }
      return out;
    }),
  };
}

/** Network that satisfies the empty-seed recognition path (returns no results). */
function emptyNetwork(): NetworkPort {
  return {
    fetch: vi.fn(async (url: string) => {
      const body =
        url.includes("/api/tmdb/") || url.includes("tmdb")
          ? { results: [], page: 1, total_pages: 1, total_results: 0 }
          : { status: "success", data: [] };
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        text: () => Promise.resolve(JSON.stringify(body)),
        json: <T>() => Promise.resolve(body as T),
      };
    }) as never,
  };
}

async function waitForStatus(core: Core, id: string, status: string): Promise<void> {
  const started = Date.now();
  for (;;) {
    const job = core.getJob(id);
    if (job?.status === status || job?.status === "failed" || job?.status === "aborted") return;
    if (Date.now() - started > 5000) throw new Error(`timeout waiting for ${status}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("Core", () => {
  it("importFolder runs the pipeline and succeeds", async () => {
    const fs = inMemoryFs({ "/m/My.Music/a.mp3": "" });
    const core = new Core({
      fs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });

    const { id } = core.importFolder("/m/My.Music", "music");
    expect(core.getJob(id)).toBeDefined();

    await waitForStatus(core, id, "succeeded");

    const job = core.getJob(id);
    expect(job?.status).toBe("succeeded");
    expect(job?.progress).toBe(100);

    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath("/data/smm"))) as string);
    expect(savedConfig.folders).toContain("/m/My.Music");
  });

  it("marks the job failed when the pipeline throws", async () => {
    const fs = inMemoryFs();
    const failingFs: FsPort = {
      ...fs,
      listFiles: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const core = new Core({
      fs: failingFs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });

    const { id } = core.importFolder("/m/Broken", "tvshow");
    await waitForStatus(core, id, "failed");

    const job = core.getJob(id);
    expect(job?.status).toBe("failed");
    expect(job?.error).toContain("boom");
  });

  it("getJob returns undefined for unknown id", () => {
    const core = new Core({
      fs: inMemoryFs(),
      network: emptyNetwork(),
      appDataDir: "/data/smm",
    });
    expect(core.getJob("nope")).toBeUndefined();
  });
});
```

Note: the `emptyNetwork` must satisfy BOTH TMDB (`/api/tmdb/search/...`) and TVDB (`/api/tvdb/search?...`) URLs. The mock branches on the presence of `tmdb` in the URL. In the failed-job test, the pipeline throws in `listFiles` before any network call, so the network shape is irrelevant.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm test`
Expected: FAIL — `./Core` cannot be resolved.

- [ ] **Step 3: Implement `Core.ts`**

`apps/core/src/Core.ts`:

```ts
import { Path } from "@core/path";
import type { FolderType } from "@smm/core";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import type { LoggerPort } from "./ports/LoggerPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./pipeline/importFolderPipeline";
import { JobStore } from "./jobs/jobStore";
import type { ImportJob } from "./jobs/types";

export interface CoreOptions {
  fs: FsPort;
  network: NetworkPort;
  logger?: LoggerPort;
  /** Root directory holding smm.json and metadata/. */
  appDataDir: string;
}

export interface ImportFolderHandle {
  id: string;
}

export class Core {
  private readonly jobs = new JobStore();
  private readonly fs: FsPort;
  private readonly network: NetworkPort;
  private readonly logger: LoggerPort;
  private readonly appDataDir: string;

  constructor(options: CoreOptions) {
    this.fs = options.fs;
    this.network = options.network;
    this.logger = options.logger ?? new NoopLoggerAdapter();
    this.appDataDir = options.appDataDir;
  }

  /** Starts the import pipeline in the background; returns a job handle immediately. */
  importFolder(path: string, type: FolderType): ImportFolderHandle {
    const job = this.jobs.create({
      folderPath: Path.posix(path),
      type,
      status: "running",
      stage: "config",
      progress: 0,
    });
    void this.runImport(job, path, type);
    return { id: job.id };
  }

  getJob(id: string): ImportJob | undefined {
    return this.jobs.get(id);
  }

  private async runImport(job: ImportJob, folderPath: string, type: FolderType): Promise<void> {
    try {
      const pipeline = new ImportFolderPipeline({
        fs: this.fs,
        network: this.network,
        logger: this.logger,
        appDataDir: this.appDataDir,
      });
      await pipeline.run(folderPath, type, {
        onStage: (stage, progress) => {
          this.jobs.update(job.id, { stage, progress });
        },
      });
      this.jobs.update(job.id, { status: "succeeded", stage: null, progress: 100 });
    } catch (error) {
      this.jobs.update(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.ts
git commit -m "feat(core-app): add Core class with importFolder API and job lifecycle"
```

---

## Task 14: Public exports + repo integration

**Files:**
- Create: `apps/core/src/index.ts`
- Modify: `package.json` (root scripts)

- [ ] **Step 1: Create `apps/core/src/index.ts`**

```ts
export { Core, type CoreOptions, type ImportFolderHandle } from "./Core";
export type { FsPort } from "./ports/FsPort";
export type { NetworkPort, FetchInit, HttpResponse } from "./ports/NetworkPort";
export type { LoggerPort } from "./ports/LoggerPort";
export { NodejsFsAdapter } from "./adapters/node/NodejsFsAdapter";
export { NetworkFsAdapter, type NetworkFsAdapterOptions } from "./adapters/network/NetworkFsAdapter";
export { FetchNetworkAdapter } from "./adapters/FetchNetworkAdapter";
export { ConsoleLoggerAdapter, NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
export { ImportFolderPipeline, type ImportFolderPipelineOptions } from "./pipeline/importFolderPipeline";
export { recognizeMediaFolder, type RecognitionDeps, type RecognitionResult } from "./pipeline/recognizeMediaFolder";
export { recognizeEpisodes, type RecognizedEpisode } from "./pipeline/recognizeEpisodes";
export { parseNfo, type ParsedNfo } from "./pipeline/nfo";
export type { ImportJob, JobStatus, JobStage } from "./jobs/types";
export type { FolderType } from "@smm/core";
```

- [ ] **Step 2: Verify typecheck + full test suite**

Run:
```bash
cd apps/core && pnpm run typecheck
cd apps/core && pnpm test
```

Expected: typecheck clean (exit 0); all tests pass.

- [ ] **Step 3: Register apps/core in the root package.json scripts**

In `C:/Users/lawrence/workspace/smm_github/package.json`, add two scripts and append `typecheck:core-app` to the `typecheck` chain:

```json
"typecheck:core-app": "cd apps/core && pnpm run typecheck",
"test:core-app": "cd apps/core && pnpm test",
```

and change the `typecheck` script from:

```json
"typecheck": "pnpm run typecheck:core && pnpm run typecheck:core-routes && pnpm run typecheck:electron-common && pnpm run typecheck:cli && pnpm run typecheck:ui && pnpm run typecheck:e2e && pnpm run typecheck:electron",
```

to:

```json
"typecheck": "pnpm run typecheck:core && pnpm run typecheck:core-routes && pnpm run typecheck:electron-common && pnpm run typecheck:cli && pnpm run typecheck:ui && pnpm run typecheck:e2e && pnpm run typecheck:electron && pnpm run typecheck:core-app",
```

Note: the root `test` script is `pnpm -r test`, which already runs `apps/core`'s `vitest run` because it is a workspace member with a `test` script — no change needed there.

- [ ] **Step 4: Verify the root scripts**

Run:
```bash
cd C:/Users/lawrence/workspace/smm_github && pnpm run test:core-app
cd C:/Users/lawrence/workspace/smm_github && pnpm run typecheck:core-app
```

Expected: tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/index.ts package.json
git commit -m "feat(core-app): export public API and register apps/core scripts at repo root"
```

---

## Self-Review

**Spec coverage:**
- §2.1 Project-level architecture (Ports + adapters, core internal clients) → Tasks 2–4, 8–9, 14.
- §2.2 App-level file layout → Task 1 + all file paths match the tree.
- §2.3 Ports interfaces → Task 2 (FsPort/NetworkPort/LoggerPort signatures match the spec).
- §2.3 Core class (`importFolder` returns `{id}`, `getJob`) → Task 13.
- §2.3 importFolder pipeline stages 1–6 → Task 12 (config → metadata → listFiles → recognize → episodes → persist, with the spec's progress boundaries).
- §2.3 Job model (`ImportJob` fields, in-memory Map, no cancel/timeout/persistence) → Tasks 6, 13.
- §3.1 tvshow import → Tasks 12 (mock-driven) + 11 (real recognition).
- §3.2 movie import → Task 11 (`movieMediaMetadataFromTmdbSearch`, exact title match) + Task 12 movie branch (first video as `mediaFiles[0]`).
- §3.3 failure → failed job with `error` → Task 13 test 2.
- §3.4 dedupe → Task 12 test 2.
- §3.5 music skip → Task 12 test 1 (config/metadata/listFiles/persist, no recognize).
- `preferMediaLanguage ?? 'en-US'` → Task 12 pipeline (language default).

**Placeholder scan:** every task has complete code, exact file paths, and exact commands. No TBD/TODO. The one cross-task mock (`vi.mock("./recognizeMediaFolder")` in Task 12) is spelled out with the exact import lines and the mock body.

**Type consistency:**
- `TmdbClient` methods used by `recognizeMediaFolder`: `search`, `getTvShowMediaMetadata`, `getMovieMediaMetadata` — all defined in Task 8.
- `TvdbClient` methods used: `searchSeries`, `searchMovie`, `getTvShowMediaMetadata`, `getMovieMediaMetadata` — all defined in Task 9.
- `recognizeMediaFolder`'s `RecognitionDeps` includes `fs` (for NFO) — pipeline passes it in Task 12.
- `ImportJob.stage` type is `JobStage` (`"config"|...|null`); pipeline emits stage names that all exist in `JobStage`. `Core` sets `stage: null` on completion — allowed.
- `nextJobId`/`JobStore` used only by `Core`; `JobStore.create` signature matches the `Core` call.
- Path helpers (`joinPosix`, `basename`, `extname`) are shared by `NodejsFsAdapter` test (Task 3) and `recognizeEpisodes` (Task 10) — identical names throughout.
- `FolderType` comes from `@smm/core` everywhere.

**Host-independence caveat (flagged, not blocking):** `NodejsFsAdapter` and the Core/Pipeline tests exercise POSIX round-trips via `Path.posix` / `Path.toPlatformPath`, so they are deterministic on both Windows and POSIX CI. The `NetworkFsAdapter` contract is implemented per the current `core-routes` endpoints (`POST /api/readFile|writeFile|listFiles`); wiring it to a live Layer 3 server is future work.
