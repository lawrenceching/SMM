# CLI `smm recognize` (Recognize Folder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `smm recognize <folder> [--db tmdb|tvdb --id <id>] [--yes]` so operators can (re)assign TMDB/TVDB title metadata to an imported folder, with auto probe + confirm, without matching episodes.

**Architecture:** New Core pipelines `tryToRecognizeFolder` (reuse `recognizeMediaFolder`, no write) and `recognizeFolder` (fetch by db+id, persist with `mediaFiles: []`). CLI wraps both; interactive confirm uses readline unless `--yes`.

**Tech Stack:** TypeScript, Vitest (`apps/core`, `apps/cli`), Bun test (`apps/e2e/cli`), Commander, Core `FsPort` / `TmdbClient` / `TvdbClient`.

**Spec:** `docs/superpowers/specs/2026-08-26-cli-recognize-folder-design.md`

## Global Constraints

- Do **not** match episodes or pick movie video files after recognition.
- Always persist `mediaFiles: []` on successful `recognizeFolder`.
- Reuse `recognizeMediaFolder` for auto probe; do not fork its rule order.
- No HTTP / MCP / UI changes.
- Keep `apps/e2e/cli/recognize.test.ts` (episodes) unchanged; add `recognize-folder.test.ts`.
- Follow red-green: fail first, then implement.
- Core methods throw `Error`; CLI prints message, exit 1.

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/pipeline/recognizeFolder.ts` | `tryToRecognizeFolderPipeline` + `recognizeFolderPipeline` + candidate types |
| `apps/core/src/pipeline/recognizeFolder.test.ts` | Pipeline unit tests |
| `apps/core/src/Core.ts` | Public `tryToRecognizeFolder` / `recognizeFolder` |
| `apps/core/src/Core.test.ts` | Core-level tests (managed check, write) |
| `apps/core/src/index.ts` | Export candidate types |
| `apps/cli/src/cli/runCli.ts` | Register `recognize` command |
| `apps/cli/src/cli/recognizeConfirm.ts` | Prompt helper (`confirmRecognizeCandidate`) |
| `apps/cli/src/cli/recognize.test.ts` | CLI unit tests with mocked Core |
| `apps/e2e/cli/recognize-folder.test.ts` | Live e2e UC1/UC2/auto/--flags |
| `docs/dev/recognize-folder.md` | Document `--yes`, mark status |

---

### Task 1: Core pipeline `tryToRecognizeFolder` / `recognizeFolder`

**Files:**
- Create: `apps/core/src/pipeline/recognizeFolder.ts`
- Create: `apps/core/src/pipeline/recognizeFolder.test.ts`

**Interfaces:**
- Consumes: `recognizeMediaFolder`, `RecognitionDeps`, `FsPort`, `UserConfig`, `metadataCachePath`, `TmdbRecognitionClient` / `TvdbRecognitionClient`
- Produces:
  ```ts
  export type RecognizeFolderDb = "tmdb" | "tvdb";
  export interface RecognizeFolderCandidate {
    db: RecognizeFolderDb;
    id: string;
    title: string;
    year?: string;
    kind: "tvshow" | "movie";
  }
  export interface RecognizeFolderDeps {
    fs: FsPort;
    appDataDir: string;
    userConfig: UserConfig;
    normalizePosix: (path: string) => string;
    tmdb: TmdbRecognitionClient;
    tvdb: TvdbRecognitionClient;
    language: string;
    primaryDatabase?: PrimaryDatabase;
  }
  export async function tryToRecognizeFolderPipeline(path: string, deps: RecognizeFolderDeps): Promise<RecognizeFolderCandidate>
  export async function recognizeFolderPipeline(path: string, options: { db: RecognizeFolderDb; id: string }, deps: RecognizeFolderDeps): Promise<void>
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/core/src/pipeline/recognizeFolder.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { UserConfig } from "./userConfig";
import {
  recognizeFolderPipeline,
  tryToRecognizeFolderPipeline,
  type RecognizeFolderDeps,
} from "./recognizeFolder";

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
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  };
}

function deps(partial: Partial<RecognizeFolderDeps> & { fs: FsPort; appDataDir: string }): RecognizeFolderDeps {
  const userConfig = new UserConfig(partial.fs, `${partial.appDataDir}/smm.json`);
  return {
    userConfig,
    normalizePosix: (p) => p.replace(/\\/g, "/"),
    language: "en-US",
    tmdb: {
      search: vi.fn(async () => ({ results: [], page: 1, total_pages: 1, total_results: 0 })),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    },
    tvdb: {
      searchSeries: vi.fn(async () => []),
      searchMovie: vi.fn(async () => []),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    },
    ...partial,
  };
}

describe("tryToRecognizeFolderPipeline", () => {
  it("returns candidate from tmdbid in folder name without writing", async () => {
    const mm = {
      mediaFolderPath: "/m/Show {tmdbid=84666}",
      type: "tvshow-folder" as const,
      mediaFiles: [{ absolutePath: "/m/Show {tmdbid=84666}/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const cacheKey = "/data/metadata/_m_Show_{tmdbid=84666}.json"; // use real metadataCachePath in impl tests
    // Prefer: seed via metadataCachePath helper in the real test file.
    const fs = inMemoryFs({
      "/data/smm.json": JSON.stringify({ folders: ["/m/Show {tmdbid=84666}"] }),
    });
    const d = deps({ fs, appDataDir: "/data" });
    // After writing cache with metadataCachePath — see Step 3 for exact seed using metadataCachePath.
    await d.userConfig.update(() => ({ folders: ["/m/Show {tmdbid=84666}"] } as never));
    const { metadataCachePath } = await import("./paths");
    const cachePath = metadataCachePath("/data", "/m/Show {tmdbid=84666}");
    await fs.writeTextFile(cachePath, JSON.stringify(mm));
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      database: "TMDB",
      id: "84666",
      name: "WATATEN",
      airDate: "2019-01-08",
      seasons: [],
    });

    const candidate = await tryToRecognizeFolderPipeline("/m/Show {tmdbid=84666}", d);
    expect(candidate).toEqual({
      db: "tmdb",
      id: "84666",
      title: "WATATEN",
      year: "2019",
      kind: "tvshow",
    });
    const writes = (fs.writeTextFile as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([p]) => p === cachePath,
    );
    expect(writes).toHaveLength(1); // only the seed write above
  });

  it("throws when unmanaged", async () => {
    const fs = inMemoryFs({ "/data/smm.json": JSON.stringify({ folders: [] }) });
    const d = deps({ fs, appDataDir: "/data" });
    await expect(tryToRecognizeFolderPipeline("/m/Other", d)).rejects.toThrow(/not managed by SMM/);
  });
});

describe("recognizeFolderPipeline", () => {
  it("writes tvShow and clears mediaFiles", async () => {
    const mm = {
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder" as const,
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({ "/data/smm.json": JSON.stringify({ folders: ["/m/Show"] }) });
    const d = deps({ fs, appDataDir: "/data" });
    const { metadataCachePath } = await import("./paths");
    const cachePath = metadataCachePath("/data", "/m/Show");
    await fs.writeTextFile(cachePath, JSON.stringify(mm));
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      database: "TMDB",
      id: "84666",
      name: "WATATEN",
      airDate: "2019-01-08",
      seasons: [{ season: 1, name: "Season 1", episodes: [] }],
    });

    await recognizeFolderPipeline("/m/Show", { db: "tmdb", id: "84666" }, d);

    const raw = await fs.readTextFile(cachePath);
    const saved = JSON.parse(raw) as typeof mm & { tvShow: { id: string }; movie?: unknown };
    expect(saved.tvShow.id).toBe("84666");
    expect(saved.mediaFiles).toEqual([]);
    expect(saved.movie).toBeUndefined();
  });
});
```

Adjust `metadataCachePath` seeding to match `apps/core/src/pipeline/paths.ts` (do not invent cache key strings).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/core && pnpm exec vitest run src/pipeline/recognizeFolder.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `apps/core/src/pipeline/recognizeFolder.ts`:

```typescript
import { Path } from "@core/path";
import type { MediaMetadata, MovieMediaMetadata, PrimaryDatabase, TvShowMediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import {
  recognizeMediaFolder,
  type RecognitionDeps,
  type TmdbRecognitionClient,
  type TvdbRecognitionClient,
} from "./recognizeMediaFolder";
import { metadataCachePath } from "./paths";
import type { UserConfig } from "./userConfig";

export type RecognizeFolderDb = "tmdb" | "tvdb";

export interface RecognizeFolderCandidate {
  db: RecognizeFolderDb;
  id: string;
  title: string;
  year?: string;
  kind: "tvshow" | "movie";
}

export interface RecognizeFolderDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfig;
  normalizePosix: (path: string) => string;
  tmdb: TmdbRecognitionClient;
  tvdb: TvdbRecognitionClient;
  language: string;
  primaryDatabase?: PrimaryDatabase;
}

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

async function loadManagedMediaMetadata(
  path: string,
  deps: RecognizeFolderDeps,
): Promise<{ posixPath: string; mm: MediaMetadata }> {
  const posixPath = deps.normalizePosix(path);
  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], path)) {
    throw new Error(`${posixPath} is not managed by SMM`);
  }
  const cachePath = metadataCachePath(deps.appDataDir, posixPath);
  if (!(await deps.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${path}`);
  }
  let mm: MediaMetadata;
  try {
    mm = JSON.parse(await deps.fs.readTextFile(cachePath)) as MediaMetadata;
  } catch {
    throw new Error(`Media metadata not found: ${path}`);
  }
  if (mm.type !== "tvshow-folder" && mm.type !== "movie-folder") {
    throw new Error(`Folder type cannot be recognized: ${mm.type ?? "unknown"}`);
  }
  return { posixPath, mm: { ...mm, mediaFolderPath: posixPath } };
}

function yearFromAirDate(airDate?: string): string | undefined {
  if (!airDate || airDate.length < 4) return undefined;
  return airDate.slice(0, 4);
}

function dbFromDatabase(database: "TMDB" | "TVDB"): RecognizeFolderDb {
  return database === "TMDB" ? "tmdb" : "tvdb";
}

function candidateFromHit(
  tvShow: TvShowMediaMetadata | undefined,
  movie: MovieMediaMetadata | undefined,
): RecognizeFolderCandidate {
  if (tvShow) {
    return {
      db: dbFromDatabase(tvShow.database),
      id: tvShow.id,
      title: tvShow.name,
      year: yearFromAirDate(tvShow.airDate),
      kind: "tvshow",
    };
  }
  if (movie) {
    return {
      db: dbFromDatabase(movie.database),
      id: movie.id,
      title: movie.name,
      year: yearFromAirDate(movie.airDate),
      kind: "movie",
    };
  }
  throw new Error("Unable to recognize folder");
}

export async function tryToRecognizeFolderPipeline(
  path: string,
  deps: RecognizeFolderDeps,
): Promise<RecognizeFolderCandidate> {
  const { mm } = await loadManagedMediaMetadata(path, deps);
  const recognitionDeps: RecognitionDeps = {
    fs: deps.fs,
    tmdb: deps.tmdb,
    tvdb: deps.tvdb,
    language: deps.language,
    primaryDatabase: deps.primaryDatabase,
  };
  const result = await recognizeMediaFolder(mm, recognitionDeps);
  if (result.tvShow === undefined && result.movie === undefined) {
    throw new Error(`Unable to recognize folder: ${path}`);
  }
  return candidateFromHit(result.tvShow, result.movie);
}

export async function recognizeFolderPipeline(
  path: string,
  options: { db: RecognizeFolderDb; id: string },
  deps: RecognizeFolderDeps,
): Promise<void> {
  const { posixPath, mm } = await loadManagedMediaMetadata(path, deps);
  const idNum = Number(options.id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    throw new Error("id must be a positive integer");
  }
  const isTv = mm.type === "tvshow-folder";
  let tvShow: TvShowMediaMetadata | undefined;
  let movie: MovieMediaMetadata | undefined;

  if (options.db === "tmdb") {
    if (isTv) {
      tvShow = await deps.tmdb.getTvShowMediaMetadata(idNum, deps.language);
    } else {
      movie = await deps.tmdb.getMovieMediaMetadata(idNum, deps.language);
    }
  } else {
    // TVDB clients expect ISO 639-3; map prefer language the same way recognizeMediaFolder does via caller-provided language for tmdb and tvdb lang for tvdb.
    // Prefer: pass language already mapped for TVDB when db=tvdb from Core (see Task 2).
    if (isTv) {
      tvShow = await deps.tvdb.getTvShowMediaMetadata(idNum, deps.language);
    } else {
      movie = await deps.tvdb.getMovieMediaMetadata(idNum, deps.language);
    }
  }

  if (isTv) {
    if (!tvShow) throw new Error(`Failed to fetch ${options.db} TV show ${options.id}`);
  } else if (!movie) {
    throw new Error(`Failed to fetch ${options.db} movie ${options.id}`);
  }

  const next: MediaMetadata = {
    mediaFolderPath: posixPath,
    type: mm.type,
    mediaFiles: [],
    ...(isTv ? { tvShow } : { movie }),
  };
  await deps.fs.writeTextFile(
    metadataCachePath(deps.appDataDir, posixPath),
    JSON.stringify(next, null, 2),
  );
}
```

**TVDB language note:** In Task 2, when `db === "tvdb"`, Core must set `deps.language` to TVDB ISO 639-3 (reuse `mapToTvdbLangCode` / `createTvdbClient` language). For `tryToRecognizeFolder`, pass TMDB IETF as `language` and let `recognizeMediaFolder` map TVDB internally (same as import). Split if needed: either two language fields on deps, or build RecognitionDeps inside Core with the same pattern as `ImportFolderPipeline` (`preferMediaLanguage` for TMDB; `recognizeMediaFolder` maps TVDB). Prefer mirroring import: `language = userConfig.preferMediaLanguage ?? "en-US"` for both try and recognize when using TMDB; for `recognizeFolder` with `db=tvdb`, use `mapToTvdbLangCode(preferMediaLanguage)`.

Refine `RecognizeFolderDeps` if cleaner:

```typescript
language: string; // TMDB IETF for try + tmdb recognize
tvdbLanguage: string; // ISO 639-3 for tvdb recognize / recognizeMediaFolder path
```

And pass `language` + map inside pipeline for `recognizeMediaFolder` as import does (single `language` IETF). For `recognizeFolder` TVDB branch use `mapToTvdbLangCode(deps.language)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/core && pnpm exec vitest run src/pipeline/recognizeFolder.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/recognizeFolder.ts apps/core/src/pipeline/recognizeFolder.test.ts
git commit -m "feat(core): add recognizeFolder pipelines"
```

---

### Task 2: Wire `Core.tryToRecognizeFolder` / `Core.recognizeFolder`

**Files:**
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/Core.test.ts`
- Modify: `apps/core/src/index.ts`

**Interfaces:**
- Consumes: `tryToRecognizeFolderPipeline`, `recognizeFolderPipeline`, `TmdbClient`, `TvdbClient`, `userConfig`
- Produces: `Core.tryToRecognizeFolder(path)`, `Core.recognizeFolder(path, { db, id })`

- [ ] **Step 1: Write the failing Core tests**

Append to `apps/core/src/Core.test.ts` (reuse existing `inMemoryFs` / `jsonResponse` helpers in that file):

```typescript
describe("tryToRecognizeFolder / recognizeFolder", () => {
  it("tryToRecognizeFolder returns candidate from folder tmdbid", async () => {
    const folder = "/m/Show {tmdbid=84666}";
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath("/data/smm", folder)]: JSON.stringify({
        mediaFolderPath: folder,
        type: "tvshow-folder",
        mediaFiles: [],
      }),
    });
    const network: NetworkPort = {
      fetch: vi.fn(async (url: string) => {
        if (String(url).includes("/tv/") && String(url).includes("84666")) {
          return jsonResponse({
            id: 84666,
            name: "WATATEN",
            first_air_date: "2019-01-08",
            seasons: [{ season_number: 1, episode_count: 1, name: "S1" }],
          });
        }
        if (String(url).includes("/tv/") && String(url).includes("/season/")) {
          return jsonResponse({ season_number: 1, episodes: [] });
        }
        return jsonResponse({ results: [] });
      }) as never,
    };
    const core = new Core({
      fs,
      network,
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const candidate = await core.tryToRecognizeFolder(folder);
    expect(candidate.db).toBe("tmdb");
    expect(candidate.id).toBe("84666");
    expect(candidate.title).toContain("WATATEN");
  });

  it("recognizeFolder clears mediaFiles", async () => {
    const folder = "/m/Show";
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath("/data/smm", folder)]: JSON.stringify({
        mediaFolderPath: folder,
        type: "tvshow-folder",
        mediaFiles: [{ absolutePath: "/m/Show/a.mkv", seasonNumber: 1, episodeNumber: 1 }],
      }),
    });
    const network: NetworkPort = {
      fetch: vi.fn(async (url: string) => {
        if (String(url).includes("/tv/") && !String(url).includes("/season/")) {
          return jsonResponse({
            id: 84666,
            name: "WATATEN",
            first_air_date: "2019-01-08",
            seasons: [{ season_number: 1, episode_count: 0, name: "S1" }],
          });
        }
        if (String(url).includes("/season/")) {
          return jsonResponse({ season_number: 1, episodes: [] });
        }
        return jsonResponse({});
      }) as never,
    };
    const core = new Core({
      fs,
      network,
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    await core.recognizeFolder(folder, { db: "tmdb", id: "84666" });
    const mm = await core.getMediaMetadata(folder);
    expect(mm?.tvShow?.id).toBe("84666");
    expect(mm?.mediaFiles).toEqual([]);
  });
});
```

Adapt network mocks to whatever `TmdbClient.getTvShowMediaMetadata` actually requests (copy patterns from `TmdbClient.test.ts` / existing Core TMDB tests).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/core && pnpm exec vitest run src/Core.test.ts -t "tryToRecognizeFolder"`

Expected: FAIL (`tryToRecognizeFolder` not a function)

- [ ] **Step 3: Implement Core methods**

In `Core.ts`, add imports and:

```typescript
async tryToRecognizeFolder(path: string): Promise<RecognizeFolderCandidate> {
  const config = await this.userConfig.read();
  const language = config.preferMediaLanguage ?? "en-US";
  const { client: tmdb } = await this.createTmdbClient({});
  const { client: tvdb } = await this.createTvdbClient({}, false);
  return tryToRecognizeFolderPipeline(path, {
    fs: this.fs,
    appDataDir: this.appDataDir,
    userConfig: this.userConfig,
    normalizePosix: (p) => this.normalizePosix(p),
    tmdb,
    tvdb,
    language,
    primaryDatabase: config.primaryDatabase,
  });
}

async recognizeFolder(
  path: string,
  options: { db: RecognizeFolderDb; id: string },
): Promise<void> {
  const config = await this.userConfig.read();
  const language = config.preferMediaLanguage ?? "en-US";
  const { client: tmdb } = await this.createTmdbClient({});
  const { client: tvdb, language: tvdbLanguage } = await this.createTvdbClient({});
  // Pipeline must use tvdbLanguage when options.db === "tvdb"; see Task 1 language note.
  await recognizeFolderPipeline(path, options, {
    fs: this.fs,
    appDataDir: this.appDataDir,
    userConfig: this.userConfig,
    normalizePosix: (p) => this.normalizePosix(p),
    tmdb,
    tvdb,
    language: options.db === "tvdb" ? tvdbLanguage : language,
    primaryDatabase: config.primaryDatabase,
  });
}
```

Export types from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/core && pnpm exec vitest run src/Core.test.ts -t "tryToRecognizeFolder|recognizeFolder"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.ts apps/core/src/Core.test.ts apps/core/src/index.ts
git commit -m "feat(core): expose tryToRecognizeFolder and recognizeFolder"
```

---

### Task 3: CLI `smm recognize` + confirm helper

**Files:**
- Create: `apps/cli/src/cli/recognizeConfirm.ts`
- Create: `apps/cli/src/cli/recognize.test.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

**Interfaces:**
- Consumes: `getCore().tryToRecognizeFolder`, `getCore().recognizeFolder`
- Produces: Commander command `recognize`

- [ ] **Step 1: Write failing CLI unit tests**

Create `apps/cli/src/cli/recognize.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCoreForTests } from '../core/getCore'

describe('smm recognize', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCoreForTests()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    vi.restoreAllMocks()
    resetCoreForTests()
  })

  it('manual mode calls recognizeFolder with db+id', async () => {
    const { Core } = await import('core-app')
    const recognizeFolder = vi.spyOn(Core.prototype, 'recognizeFolder').mockResolvedValue()
    const { runCli } = await import('./runCli')
    const code = await runCli([
      'node', 'smm', 'recognize', '/m/Show', '--db', 'tmdb', '--id', '84666',
    ])
    expect(code).toBe(0)
    expect(recognizeFolder).toHaveBeenCalledWith('/m/Show', { db: 'tmdb', id: '84666' })
    expect(logSpy).toHaveBeenCalledWith('Metadata is updated')
  })

  it('exits 1 when only --db is provided', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'recognize', '/m/Show', '--db', 'tmdb'])
    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('--yes accepts tryToRecognizeFolder candidate', async () => {
    const { Core } = await import('core-app')
    vi.spyOn(Core.prototype, 'tryToRecognizeFolder').mockResolvedValue({
      db: 'tmdb',
      id: '84666',
      title: 'WATATEN',
      year: '2019',
      kind: 'tvshow',
    })
    const recognizeFolder = vi.spyOn(Core.prototype, 'recognizeFolder').mockResolvedValue()
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'recognize', '/m/Show', '--yes'])
    expect(code).toBe(0)
    expect(recognizeFolder).toHaveBeenCalledWith('/m/Show', { db: 'tmdb', id: '84666' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/cli && pnpm exec vitest run src/cli/recognize.test.ts`

Expected: FAIL (unknown command / not called)

- [ ] **Step 3: Implement confirm helper + command**

Create `apps/cli/src/cli/recognizeConfirm.ts`:

```typescript
import * as readline from 'node:readline'

export function formatRecognizePrompt(candidate: {
  title: string
  year?: string
}): string {
  const label =
    candidate.year !== undefined
      ? `${candidate.title} (${candidate.year})`
      : candidate.title
  return `Is it "${label}"? [Y/n]`
}

/** Returns true if user accepts (empty / y / yes). */
export async function confirmRecognizeCandidate(
  candidate: { title: string; year?: string },
  options: { yes?: boolean; ask?: (question: string) => Promise<string> } = {},
): Promise<boolean> {
  if (options.yes) return true
  const ask =
    options.ask ??
    (async (question: string) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise<string>((resolve) => {
        rl.question(question + ' ', resolve)
      })
      rl.close()
      return answer
    })
  const raw = (await ask(formatRecognizePrompt(candidate))).trim().toLowerCase()
  if (raw === '' || raw === 'y' || raw === 'yes') return true
  return false
}
```

In `runCli.ts`, register:

```typescript
program
  .command('recognize')
  .description('Recognize an imported media folder as a TMDB/TVDB TV show or movie')
  .argument('<folder>', 'Imported media folder path')
  .addOption(new Option('--db <db>', 'Media database').choices(['tmdb', 'tvdb']))
  .option('--id <id>', 'TMDB or TVDB id')
  .option('-y, --yes', 'Accept auto-recognition candidate without prompting')
  .action(async (folder: string, opts: { db?: string; id?: string; yes?: boolean }) => {
    try {
      const hasDb = opts.db !== undefined
      const hasId = opts.id !== undefined
      if (hasDb !== hasId) {
        console.error('--db and --id must be provided together')
        exitCode = 1
        return
      }
      const core = getCore()
      if (hasDb && hasId) {
        await core.recognizeFolder(folder, {
          db: opts.db as 'tmdb' | 'tvdb',
          id: opts.id!,
        })
        console.log('Metadata is updated')
        return
      }
      const candidate = await core.tryToRecognizeFolder(folder)
      const label =
        candidate.year !== undefined
          ? `${candidate.title} (${candidate.year})`
          : candidate.title
      // optional: print suggestion line before confirm
      const accepted = await confirmRecognizeCandidate(candidate, { yes: Boolean(opts.yes) })
      if (!accepted) {
        console.log('Cancelled')
        return
      }
      await core.recognizeFolder(folder, { db: candidate.db, id: candidate.id })
      console.log('Metadata is updated')
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      exitCode = 1
    }
  })
```

Update `runCli` JSDoc command list to include `recognize`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/cli && pnpm exec vitest run src/cli/recognize.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/runCli.ts apps/cli/src/cli/recognizeConfirm.ts apps/cli/src/cli/recognize.test.ts
git commit -m "feat(cli): add smm recognize command"
```

---

### Task 4: Live e2e `apps/e2e/cli/recognize-folder.test.ts`

**Files:**
- Create: `apps/e2e/cli/recognize-folder.test.ts`

**Interfaces:**
- Consumes: `bin`, `setup`/`cleanup`, `folder1`/`folder4`, `createFolderInTestFolder`, `$`

- [ ] **Step 1: Write the e2e tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'
import { folder1, folder4, createFolderInTestFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'

const FIVE_MINUTES_MS = 5 * 60 * 1000

describe('recognize folder', () => {
  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: () => {},
    })
  })

  afterEach(async () => {
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
    })
  })

  it('UC1: recognize with TMDB id', async () => {
    const folder = createFolderInTestFolder({ ...folder1 })
    const folderPath = folder.path!
    const added = await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
    expect(added.exitCode).toBe(0)

    const recognized = await $`${bin} recognize ${folderPath} --db tmdb --id 84666`.nothrow()
    expect(recognized.exitCode).toBe(0)
    expect(recognized.text()).toMatch(/Metadata is updated/i)

    const meta = await $`${bin} metadata ${folderPath}`.nothrow()
    expect(meta.exitCode).toBe(0)
    expect(meta.text()).toContain('database: TMDB')
    expect(meta.text()).toContain('id: 84666')
    expect(meta.text()).toMatch(/mediaFiles:\s*\n\s*\(empty\)/)
  }, FIVE_MINUTES_MS)

  it('UC2: recognize with TVDB id', async () => {
    const folder = createFolderInTestFolder({ ...folder4 })
    const folderPath = folder.path!
    const added = await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
    expect(added.exitCode).toBe(0)

    const recognized = await $`${bin} recognize ${folderPath} --db tvdb --id 421069`.nothrow()
    expect(recognized.exitCode).toBe(0)

    const meta = await $`${bin} metadata ${folderPath}`.nothrow()
    expect(meta.exitCode).toBe(0)
    expect(meta.text()).toContain('database: TVDB')
    expect(meta.text()).toContain('id: 421069')
    expect(meta.text()).toMatch(/mediaFiles:\s*\n\s*\(empty\)/)
  }, FIVE_MINUTES_MS)

  it('auto recognize with --yes using tmdbid in folder name', async () => {
    const folder = createFolderInTestFolder({ ...folder1 })
    const folderPath = folder.path!
    await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()

    const recognized = await $`${bin} recognize ${folderPath} --yes`.nothrow()
    expect(recognized.exitCode).toBe(0)
    expect(recognized.text()).toMatch(/Metadata is updated/i)

    const meta = await $`${bin} metadata ${folderPath}`.nothrow()
    expect(meta.text()).toContain('id: 84666')
    expect(meta.text()).toMatch(/mediaFiles:\s*\n\s*\(empty\)/)
  }, FIVE_MINUTES_MS)

  it('rejects unmanaged folder', async () => {
    const result = await $`${bin} recognize ${join(process.cwd(), 'not-imported')} --db tmdb --id 1`.nothrow()
    expect(result.exitCode).toBe(1)
    expect(cliOutput(result)).toMatch(/not managed by SMM/i)
  })

  it('rejects unpaired --db / --id', async () => {
    const folder = createFolderInTestFolder({ ...folder1 })
    const folderPath = folder.path!
    await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
    const result = await $`${bin} recognize ${folderPath} --db tmdb`.nothrow()
    expect(result.exitCode).toBe(1)
    expect(cliOutput(result)).toMatch(/--db and --id/i)
  })
})
```

- [ ] **Step 2: Run e2e (expect fail before Task 3, pass after)**

Run from repo root:

```bash
cd apps/e2e && pnpm exec bun test ./cli/recognize-folder.test.ts
```

(or project’s usual CLI e2e runner if documented in `apps/e2e/cli/README.md`)

Expected after Tasks 1–3: PASS (network required for UC1/UC2/auto)

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/cli/recognize-folder.test.ts
git commit -m "test(e2e): cover smm recognize folder"
```

---

### Task 5: Update product docs

**Files:**
- Modify: `docs/dev/recognize-folder.md`
- Modify: `docs/api/index.md` (brief CLI note if other CLI commands are listed)

- [ ] **Step 1: Update docs**

In `recognize-folder.md`:

- Set **Status** to `done` (or `implemented`) when e2e passes
- Document `--yes` / `-y` under auto section
- Keep UC1/UC2; mention auto `--yes` test

In `docs/api/index.md`, add a short line for `smm recognize` next to other CLI notes.

- [ ] **Step 2: Commit**

```bash
git add docs/dev/recognize-folder.md docs/api/index.md
git commit -m "docs: document smm recognize --yes"
```

---

## Self-Review

1. **Spec coverage:** UC1, UC2, auto+`--yes`, flag pairing, unmanaged, Core APIs, `mediaFiles: []` — all have tasks.
2. **Placeholders:** TVDB language handling called out explicitly in Tasks 1–2 (use `mapToTvdbLangCode` / `createTvdbClient` language).
3. **Type consistency:** `RecognizeFolderDb`, `RecognizeFolderCandidate`, `{ db, id }` options match across Core, CLI, e2e.
4. **Episode recognize untouched:** `try-to-recognize` / `recognize.test.ts` not modified.
