# Log Sensitive Information Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep api keys and hostnames out of `browser.log` and `smm.log` via two cooperating layers — a frontend structural redaction at the two known `UserConfig` log sites, and a backend in-memory blacklist that wraps every pino destination's `write()`.

**Architecture:** Frontend `redactUserConfig<T>()` deep-clones the input and replaces any string value at a key named `apiKey` with `"******"`. Backend `sensitiveBlacklist.ts` holds a module-level `Set<string>` of sensitive strings (hostname + every non-empty `apiKey` in `smm.json` at startup) and exposes `maskSensitive(text)` (length-descending `replaceAll`) and `wrapWithMasking(stream)` (Writable proxy). `logger.ts` calls `await initSensitiveStrings()` before creating pino instances, and wraps both the file and console destinations with `wrapWithMasking`.

**Tech Stack:** Vitest (test runner), Hono (backend, unchanged), pino (existing, wrapped), Node `node:os` + `node:fs/promises` + `node:stream` (stdlib).

**Spec:** `docs/superpowers/specs/2026-06-29-log-sensitive-redaction-design.md`

**Working directory:** All commands assume repo root `C:\Users\lawrence\workspace\smm_github`.

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `apps/ui/src/lib/redactUserConfig.ts` | Pure function: deep-clone + replace `apiKey` strings with `"******"`. Cycle-safe via `WeakSet`. |
| `apps/ui/src/lib/redactUserConfig.test.ts` | Vitest suite: 12 cases covering all api key fields, deep nesting, arrays, cycle, immutability, type edges. |
| `apps/cli/src/utils/sensitiveBlacklist.ts` | Module-level `Set<string>` + 5 exports: `addSensitiveString`, `maskSensitive`, `initSensitiveStrings`, `wrapWithMasking`, `_resetSensitiveStringsForTests`. |
| `apps/cli/src/utils/sensitiveBlacklist.test.ts` | Vitest suite: 4 describe blocks covering each public function plus `init` integration with temp `smm.json` fixtures. |

### Modified files

| Path | Change |
|------|--------|
| `apps/ui/src/hooks/userConfig/AppLanguageSync.tsx` | Wrap `userConfig` with `redactUserConfig` before `JSON.stringify` (line 37). |
| `apps/ui/src/hooks/userConfig/useReloadAppConfig.ts` | Wrap `config` with `redactUserConfig` before `console.log` (line 35). |
| `apps/cli/lib/logger.ts` | `await initSensitiveStrings()` at module top; wrap `pino.destination(...)` and `createFrontendLogStream()` with `wrapWithMasking`; wrap console mode stdout with same. |

### Untouched

- `apps/cli/src/route/Log.ts` — route handler unchanged; the masking happens at the destination.
- `apps/cli/src/utils/config.ts` — `getUserConfigPath()` already honours `USER_DATA_DIR`; we use it from the test fixture.
- `apps/cli/src/utils/FrontendLogFile.ts` — `createFrontendLogStream()` unchanged; the wrapper is applied at its call site in `logger.ts`.
- All other 119 files containing `console.*` — only the two known `UserConfig` log sites are changed. Other `console.*` calls don't carry sensitive data structurally.

---

## Task 1: Frontend `redactUserConfig` (TDD)

**Files:**
- Create: `apps/ui/src/lib/redactUserConfig.test.ts`
- Create: `apps/ui/src/lib/redactUserConfig.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/ui/src/lib/redactUserConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { redactUserConfig } from "./redactUserConfig";

describe("redactUserConfig", () => {
  it("returns an empty object for an empty input", () => {
    expect(redactUserConfig({})).toEqual({});
  });

  it("redacts tmdb.apiKey", () => {
    const input = { tmdb: { apiKey: "tmdb-secret" } };
    expect(redactUserConfig(input).tmdb.apiKey).toBe("******");
  });

  it("redacts tvdb.apiKey", () => {
    const input = { tvdb: { apiKey: "tvdb-secret" } };
    expect(redactUserConfig(input).tvdb.apiKey).toBe("******");
  });

  it("redacts every entry in ai: Record<string, OpenAICompatibleConfig>", () => {
    const input = {
      ai: {
        openai: { apiKey: "openai-secret" },
        custom: { apiKey: "custom-secret" },
      },
    };
    const result = redactUserConfig(input);
    expect(result.ai.openai.apiKey).toBe("******");
    expect(result.ai.custom.apiKey).toBe("******");
  });

  it("redacts every element in aiProviders: Array<OpenAICompatibleConfig>", () => {
    const input = {
      aiProviders: [
        { name: "p1", apiKey: "k1" },
        { name: "p2", apiKey: "k2" },
      ],
    };
    const result = redactUserConfig(input);
    expect(result.aiProviders[0].apiKey).toBe("******");
    expect(result.aiProviders[1].apiKey).toBe("******");
  });

  it("walks deeply nested objects", () => {
    const input = { a: { b: { c: { apiKey: "deep-secret" } } } };
    expect(redactUserConfig(input).a.b.c.apiKey).toBe("******");
  });

  it("walks array elements", () => {
    const input = { providers: [{ items: [{ apiKey: "nested-secret" }] }] };
    expect(redactUserConfig(input).providers[0].items[0].apiKey).toBe("******");
  });

  it("does not mutate the input", () => {
    const input = { tmdb: { apiKey: "secret" }, tvdb: { apiKey: "secret" } };
    const snapshot = JSON.parse(JSON.stringify(input));
    redactUserConfig(input);
    expect(input).toEqual(snapshot);
  });

  it("leaves non-string apiKey values alone", () => {
    const input = { tmdb: { apiKey: 42 as unknown as string } };
    expect(redactUserConfig(input).tmdb.apiKey).toBe(42);
  });

  it("leaves empty string apiKey alone", () => {
    const input = { tmdb: { apiKey: "" } };
    expect(redactUserConfig(input).tmdb.apiKey).toBe("");
  });

  it("returns '[Circular]' for cycle leaves", () => {
    const input: { tmdb: { self?: unknown; apiKey: string } } = {
      tmdb: { apiKey: "secret" },
    };
    input.tmdb.self = input;
    const result = redactUserConfig(input);
    expect(result.tmdb.self).toBe("[Circular]");
  });

  it("preserves non-apiKey fields verbatim", () => {
    const input = {
      tmdb: { host: "http://api.tmdb.org", apiKey: "secret" },
      folders: ["/a", "/b"],
    };
    const result = redactUserConfig(input);
    expect(result.tmdb.host).toBe("http://api.tmdb.org");
    expect(result.folders).toEqual(["/a", "/b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (function not defined)**

```bash
pnpm --filter ui exec vitest run src/lib/redactUserConfig.test.ts
```

Expected: FAIL with `Failed to resolve import "./redactUserConfig"` (file does not exist yet).

- [ ] **Step 3: Implement `redactUserConfig`**

Create `apps/ui/src/lib/redactUserConfig.ts`:

```ts
const PLACEHOLDER = "******";

function clone<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]" as unknown as T;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => clone(v, seen)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "apiKey" && typeof v === "string") {
      out[k] = PLACEHOLDER;
    } else {
      out[k] = clone(v, seen);
    }
  }
  return out as T;
}

export function redactUserConfig<T>(config: T): T {
  return clone(config, new WeakSet());
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter ui exec vitest run src/lib/redactUserConfig.test.ts
```

Expected: 12 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/redactUserConfig.ts apps/ui/src/lib/redactUserConfig.test.ts
git commit -m "feat(ui): add redactUserConfig helper

Deep-clones a UserConfig and replaces any string at a key named
apiKey with '******'. Cycle-safe, non-mutating. Used at the two
known log sites that emit UserConfig so api keys never reach the
console interceptor.
"
```

---

## Task 2: Apply `redactUserConfig` in `AppLanguageSync`

**Files:**
- Modify: `apps/ui/src/hooks/userConfig/AppLanguageSync.tsx:1-41`

- [ ] **Step 1: Add the import and apply the redaction**

In `apps/ui/src/hooks/userConfig/AppLanguageSync.tsx`, change the import block at the top (lines 1–6) to add the new import:

```ts
import { useEffect } from "react"
import { resolveAppLanguage } from "@core/locale"
import { changeLanguage } from "@/lib/i18n"
import { redactUserConfig } from "@/lib/redactUserConfig"
import { useHelloQuery } from "./useHelloQuery"
import { useUserConfigQuery } from "./useUserConfigQuery"
```

Then change line 37 from:

```ts
    console.log("[AppLanguageSync] userConfig: " + JSON.stringify(userConfig))
```

to:

```ts
    console.log("[AppLanguageSync] userConfig: " + JSON.stringify(redactUserConfig(userConfig)))
```

The final file should match (only the additions above):

```ts
import { useEffect } from "react"
import { resolveAppLanguage } from "@core/locale"
import { changeLanguage } from "@/lib/i18n"
import { redactUserConfig } from "@/lib/redactUserConfig"
import { useHelloQuery } from "./useHelloQuery"
import { useUserConfigQuery } from "./useUserConfigQuery"

const debug = import.meta.env.DEV

/**
 * Keeps i18n in sync with the resolved application language priority chain:
 * smm.json > browser > OS > English.
 */
export function AppLanguageSync() {
  const helloQuery = useHelloQuery()
  const userDataDir = helloQuery.data?.userDataDir
  const userConfigQuery = useUserConfigQuery(userDataDir)
  const userConfig = userConfigQuery.data

  useEffect(() => {
    if (!userConfigQuery.isSuccess) return

    const resolved = resolveAppLanguage({
      configured: userConfig?.applicationLanguage,
      browserLocale: typeof navigator !== "undefined" ? navigator.language : undefined,
      osLocale: helloQuery.data?.osLocale,
    })

    changeLanguage(resolved).catch(console.error)
  }, [
    userConfigQuery.isSuccess,
    userConfig?.applicationLanguage,
    helloQuery.data?.osLocale,
  ])

  useEffect(() => {
    if (!debug || !userConfigQuery.isSuccess) return
    console.log("[AppLanguageSync] userConfig: " + JSON.stringify(redactUserConfig(userConfig)))
  }, [userConfig, userConfigQuery.isSuccess])

  return null
}
```

- [ ] **Step 2: Verify the file is well-formed**

```bash
pnpm --filter ui run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run UI tests to ensure no regression**

```bash
pnpm --filter ui test
```

Expected: all existing tests pass + the 12 new tests from Task 1.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/hooks/userConfig/AppLanguageSync.tsx
git commit -m "fix(ui): redact UserConfig api keys in AppLanguageSync log
"
```

---

## Task 3: Apply `redactUserConfig` in `useReloadAppConfig`

**Files:**
- Modify: `apps/ui/src/hooks/userConfig/useReloadAppConfig.ts:1-55`

- [ ] **Step 1: Add the import and apply the redaction**

In `apps/ui/src/hooks/userConfig/useReloadAppConfig.ts`, change the import block at the top (lines 1–7) to add the new import:

```ts
import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { UserConfig } from "@core/types"
import { redactUserConfig } from "@/lib/redactUserConfig"
import { hello } from "@/api/hello"
import { readUserConfigFromUserDataDir } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"
```

Then change line 35 from:

```ts
        console.log("[useReloadAppConfig] Reloaded user config", config)
```

to:

```ts
        console.log("[useReloadAppConfig] Reloaded user config", redactUserConfig(config))
```

The final file should match (only the additions above):

```ts
import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { UserConfig } from "@core/types"
import { redactUserConfig } from "@/lib/redactUserConfig"
import { hello } from "@/api/hello"
import { readUserConfigFromUserDataDir } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export interface ReloadCallback {
  onSuccess?: (config: UserConfig) => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>
}

export function useReloadAppConfig() {
  const queryClient = useQueryClient()
  const [reloadLoading, setReloadLoading] = useState(false)
  const [reloadError, setReloadError] = useState<Error | null>(null)

  const reload = useCallback(
    async (callback?: ReloadCallback) => {
      try {
        setReloadLoading(true)
        setReloadError(null)

        const data = await queryClient.fetchQuery({
          queryKey: helloQueryKey,
          queryFn: () => hello(),
        })
        console.log(`[useReloadAppConfig] Reloaded user data directory: ${data.userDataDir}`)

        const config = await queryClient.fetchQuery({
          queryKey: userConfigQueryKey(data.userDataDir),
          queryFn: () => readUserConfigFromUserDataDir(data.userDataDir),
        })
        console.log("[useReloadAppConfig] Reloaded user config", redactUserConfig(config))

        if (callback?.onSuccess) {
          await callback.onSuccess(config)
        }
      } catch (err) {
        const errObj = err instanceof Error ? err : new Error("Unknown error")
        console.error("Failed to fetch app config:", err)
        setReloadError(errObj)
        if (callback?.onError) {
          await callback.onError(errObj)
        }
      } finally {
        setReloadLoading(false)
      }
    },
    [queryClient],
  )

  return { reload, reloadLoading, reloadError }
}
```

- [ ] **Step 2: Verify the file is well-formed**

```bash
pnpm --filter ui run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run UI tests to ensure no regression**

```bash
pnpm --filter ui test
```

Expected: all existing tests + the 12 new tests from Task 1 still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/hooks/userConfig/useReloadAppConfig.ts
git commit -m "fix(ui): redact UserConfig api keys in useReloadAppConfig log
"
```

---

## Task 4: Backend `addSensitiveString` + `maskSensitive` (TDD)

**Files:**
- Create: `apps/cli/src/utils/sensitiveBlacklist.test.ts`
- Create: `apps/cli/src/utils/sensitiveBlacklist.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/cli/src/utils/sensitiveBlacklist.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  addSensitiveString,
  maskSensitive,
  _resetSensitiveStringsForTests,
} from "./sensitiveBlacklist";

describe("maskSensitive", () => {
  beforeEach(() => {
    _resetSensitiveStringsForTests();
  });

  it("returns text unchanged when the set is empty", () => {
    expect(maskSensitive("nothing to mask here")).toBe("nothing to mask here");
  });

  it("replaces a single sensitive string", () => {
    addSensitiveString("secret");
    expect(maskSensitive("hello secret world")).toBe("hello ****** world");
  });

  it("replaces every occurrence", () => {
    addSensitiveString("abc");
    expect(maskSensitive("abc x abc y abc")).toBe("****** x ****** y ******");
  });

  it("does not add empty strings (so they do not match everywhere)", () => {
    addSensitiveString("");
    addSensitiveString("   ");
    expect(maskSensitive("any value with empty {matching} braces")).toBe(
      "any value with empty {matching} braces",
    );
  });

  it("replaces the longer string first so a shorter one cannot break it", () => {
    addSensitiveString("abc");
    addSensitiveString("abcdef");
    // If we replaced "abc" first, "abcdef" would become "******def" and
    // the longer substitution would miss. Length-descending order fixes this.
    expect(maskSensitive("the abcdef is here")).toBe("the ****** is here");
  });

  it("handles strings with regex special chars as plain literals (no escaping needed)", () => {
    addSensitiveString("a.b+c");
    expect(maskSensitive("value: a.b+c end")).toBe("value: ****** end");
  });

  it("returns empty string unchanged", () => {
    expect(maskSensitive("")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter cli exec vitest run src/utils/sensitiveBlacklist.test.ts
```

Expected: FAIL with `Failed to resolve import "./sensitiveBlacklist"`.

- [ ] **Step 3: Implement `addSensitiveString` + `maskSensitive`**

Create `apps/cli/src/utils/sensitiveBlacklist.ts`:

```ts
const PLACEHOLDER = "******";
const sensitiveStrings = new Set<string>();

export function addSensitiveString(s: string): void {
  const trimmed = s.trim();
  if (trimmed === "") return;
  sensitiveStrings.add(trimmed);
}

export function maskSensitive(text: string): string {
  if (sensitiveStrings.size === 0) return text;
  if (text === "") return text;
  // Length-descending so a longer match wins over a shorter prefix/substring.
  const sorted = Array.from(sensitiveStrings).sort((a, b) => b.length - a.length);
  let result = text;
  for (const s of sorted) {
    result = result.replaceAll(s, PLACEHOLDER);
  }
  return result;
}

export function _resetSensitiveStringsForTests(): void {
  sensitiveStrings.clear();
}
```

(The remaining exports — `initSensitiveStrings` and `wrapWithMasking` — are added in Tasks 5 and 6.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter cli exec vitest run src/utils/sensitiveBlacklist.test.ts
```

Expected: 7 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/utils/sensitiveBlacklist.ts apps/cli/src/utils/sensitiveBlacklist.test.ts
git commit -m "feat(cli): add sensitiveString blacklist and maskSensitive

In-memory Set of strings; maskSensitive replaces every occurrence
with '******' in length-descending order to prevent shorter
prefixes from breaking longer matches. Empty strings are skipped
to avoid matching every empty field.
"
```

---

## Task 5: Backend `initSensitiveStrings` (TDD)

**Files:**
- Modify: `apps/cli/src/utils/sensitiveBlacklist.ts`
- Modify: `apps/cli/src/utils/sensitiveBlacklist.test.ts`

- [ ] **Step 1: Append failing tests for `initSensitiveStrings`**

Append the following to `apps/cli/src/utils/sensitiveBlacklist.test.ts` (do not touch the existing `describe` block):

```ts
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initSensitiveStrings } from "./sensitiveBlacklist";

describe("initSensitiveStrings", () => {
  let tempDir: string;
  let originalUserDataDir: string | undefined;

  beforeEach(() => {
    _resetSensitiveStringsForTests();
    tempDir = mkdtempSync(join(tmpdir(), "smm-sens-test-"));
    originalUserDataDir = process.env.USER_DATA_DIR;
    process.env.USER_DATA_DIR = tempDir;
  });

  afterEach(() => {
    if (originalUserDataDir === undefined) {
      delete process.env.USER_DATA_DIR;
    } else {
      process.env.USER_DATA_DIR = originalUserDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("succeeds and adds only the hostname when smm.json is missing", async () => {
    await expect(initSensitiveStrings()).resolves.not.toThrow();
    const hostname = os.hostname();
    if (hostname) {
      expect(maskSensitive(`the host is ${hostname}`)).toBe("the host is ******");
    }
    expect(maskSensitive("just a normal string")).toBe("just a normal string");
  });

  it("collects all non-empty apiKey fields from a valid smm.json", async () => {
    writeFileSync(
      join(tempDir, "smm.json"),
      JSON.stringify({
        tmdb: { apiKey: "tmdb-abc", host: "" },
        tvdb: { apiKey: "tvdb-def" },
        ai: {
          openai: { apiKey: "openai-ghi" },
          custom: { apiKey: "" }, // empty — should be skipped
        },
        aiProviders: [
          { name: "provider1", apiKey: "prov-jkl" },
          { name: "provider2", baseURL: "http://x" }, // no apiKey
        ],
      }),
    );

    await initSensitiveStrings();

    expect(maskSensitive("use tmdb-abc here")).toBe("use ****** here");
    expect(maskSensitive("and tvdb-def too")).toBe("and ****** too");
    expect(maskSensitive("and openai-ghi")).toBe("and ******");
    expect(maskSensitive("and prov-jkl")).toBe("and ******");
  });

  it("warns and continues when smm.json is malformed", async () => {
    writeFileSync(join(tempDir, "smm.json"), "not valid json{{{");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(initSensitiveStrings()).resolves.not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    // Init must have continued past the parse error: hostname should still be in the set.
    const hostname = os.hostname();
    if (hostname) {
      expect(maskSensitive(`the host is ${hostname}`)).toBe("the host is ******");
    }

    warnSpy.mockRestore();
  });

  it("warns and continues when os.hostname() throws", async () => {
    const spy = vi.spyOn(os, "hostname").mockImplementation(() => {
      throw new Error("hostname failed");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(initSensitiveStrings()).resolves.not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    spy.mockRestore();
    warnSpy.mockRestore();
  });

  it("re-seeds: a second call replaces the previous set", async () => {
    writeFileSync(
      join(tempDir, "smm.json"),
      JSON.stringify({ tmdb: { apiKey: "old-key" } }),
    );
    await initSensitiveStrings();
    expect(maskSensitive("contains old-key")).toBe("contains ******");

    writeFileSync(
      join(tempDir, "smm.json"),
      JSON.stringify({ tmdb: { apiKey: "new-key" } }),
    );
    await initSensitiveStrings();
    // Old key should be gone after re-seed:
    expect(maskSensitive("contains old-key")).toBe("contains old-key");
    expect(maskSensitive("contains new-key")).toBe("contains ******");
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
pnpm --filter cli exec vitest run src/utils/sensitiveBlacklist.test.ts
```

Expected: FAIL with `initSensitiveStrings` is not exported.

- [ ] **Step 3: Implement `initSensitiveStrings`**

Append to `apps/cli/src/utils/sensitiveBlacklist.ts` (above the existing `_resetSensitiveStringsForTests`):

```ts
import os from "node:os";
import { readFile } from "node:fs/promises";
import { getUserConfigPath } from "./config";

function walkApiKeys(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) walkApiKeys(item, seen);
    return;
  }

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "apiKey" && typeof v === "string" && v.trim() !== "") {
      addSensitiveString(v);
    } else {
      walkApiKeys(v, seen);
    }
  }
}

export async function initSensitiveStrings(): Promise<void> {
  // Re-seed: clear first so repeated calls don't accumulate stale entries.
  sensitiveStrings.clear();

  try {
    addSensitiveString(os.hostname());
  } catch (err) {
    // Not fatal — backend can run without hostname masking.
    // We use console.warn (NOT the pino logger) because this runs during
    // logger.ts module init; importing the logger would be a cycle.
    console.warn("[sensitiveBlacklist] failed to read hostname:", err);
  }

  const configPath = getUserConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    walkApiKeys(parsed, new WeakSet());
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return; // No smm.json — that's fine.
    console.warn(
      `[sensitiveBlacklist] failed to parse smm.json at ${configPath}:`,
      err,
    );
  }
}
```

The final file should look like (combined view):

```ts
import os from "node:os";
import { readFile } from "node:fs/promises";
import { getUserConfigPath } from "./config";

const PLACEHOLDER = "******";
const sensitiveStrings = new Set<string>();

export function addSensitiveString(s: string): void {
  const trimmed = s.trim();
  if (trimmed === "") return;
  sensitiveStrings.add(trimmed);
}

export function maskSensitive(text: string): string {
  if (sensitiveStrings.size === 0) return text;
  if (text === "") return text;
  const sorted = Array.from(sensitiveStrings).sort((a, b) => b.length - a.length);
  let result = text;
  for (const s of sorted) {
    result = result.replaceAll(s, PLACEHOLDER);
  }
  return result;
}

function walkApiKeys(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) walkApiKeys(item, seen);
    return;
  }

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "apiKey" && typeof v === "string" && v.trim() !== "") {
      addSensitiveString(v);
    } else {
      walkApiKeys(v, seen);
    }
  }
}

export async function initSensitiveStrings(): Promise<void> {
  sensitiveStrings.clear();

  try {
    addSensitiveString(os.hostname());
  } catch (err) {
    console.warn("[sensitiveBlacklist] failed to read hostname:", err);
  }

  const configPath = getUserConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    walkApiKeys(parsed, new WeakSet());
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return;
    console.warn(
      `[sensitiveBlacklist] failed to parse smm.json at ${configPath}:`,
      err,
    );
  }
}

export function _resetSensitiveStringsForTests(): void {
  sensitiveStrings.clear();
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

```bash
pnpm --filter cli exec vitest run src/utils/sensitiveBlacklist.test.ts
```

Expected: 12 passed (7 from Task 4 + 5 from Task 5), 0 failed.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/utils/sensitiveBlacklist.ts apps/cli/src/utils/sensitiveBlacklist.test.ts
git commit -m "feat(cli): init sensitive blacklist from hostname + smm.json

Reads os.hostname() and every non-empty apiKey in smm.json at
startup. Re-seeds on every call so tests can mutate the fixture
between assertions. Uses console.warn (not the pino logger) for
parse errors to avoid a circular import during logger init.
"
```

---

## Task 6: Backend `wrapWithMasking` (TDD)

**Files:**
- Modify: `apps/cli/src/utils/sensitiveBlacklist.ts`
- Modify: `apps/cli/src/utils/sensitiveBlacklist.test.ts`

- [ ] **Step 1: Append failing tests for `wrapWithMasking`**

Append the following to `apps/cli/src/utils/sensitiveBlacklist.test.ts`:

```ts
import { Writable } from "node:stream";
import { wrapWithMasking } from "./sensitiveBlacklist";

describe("wrapWithMasking", () => {
  beforeEach(() => {
    _resetSensitiveStringsForTests();
  });

  it("masks each write through the inner stream", () => new Promise<void>((resolve) => {
    const writes: string[] = [];
    const inner = new Writable({
      write(chunk, _enc, cb) {
        writes.push(chunk.toString());
        cb();
      },
    });
    const wrapped = wrapWithMasking(inner);
    addSensitiveString("secret");

    wrapped.write("hello secret world", () => {
      expect(writes).toEqual(["hello ****** world"]);
      resolve();
    });
  }));

  it("passes empty string through unchanged", () => new Promise<void>((resolve) => {
    const writes: string[] = [];
    const inner = new Writable({
      write(chunk, _enc, cb) {
        writes.push(chunk.toString());
        cb();
      },
    });
    const wrapped = wrapWithMasking(inner);
    addSensitiveString("secret");

    wrapped.write("", () => {
      expect(writes).toEqual([""]);
      resolve();
    });
  }));

  it("preserves the encoding argument on the inner write", () => new Promise<void>((resolve) => {
    let receivedEncoding: BufferEncoding | undefined;
    const inner = new Writable({
      write(_chunk, encoding, cb) {
        receivedEncoding = encoding;
        cb();
      },
    });
    const wrapped = wrapWithMasking(inner);

    wrapped.write("payload", "utf-8", () => {
      expect(receivedEncoding).toBe("utf-8");
      resolve();
    });
  }));

  it("propagates underlying write errors via the callback", () => new Promise<void>((resolve) => {
    const inner = new Writable({
      write(_chunk, _enc, cb) {
        cb(new Error("boom"));
      },
    });
    const wrapped = wrapWithMasking(inner);
    // Suppress uncaught error from the Writable (we test via the callback).
    wrapped.on("error", () => {});

    wrapped.write("data", (err) => {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("boom");
      resolve();
    });
  }));
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
pnpm --filter cli exec vitest run src/utils/sensitiveBlacklist.test.ts
```

Expected: FAIL with `wrapWithMasking` is not exported.

- [ ] **Step 3: Implement `wrapWithMasking`**

Append to `apps/cli/src/utils/sensitiveBlacklist.ts` (above `_resetSensitiveStringsForTests`):

```ts
import { Writable } from "node:stream";

export function wrapWithMasking(
  inner: NodeJS.WritableStream,
): NodeJS.WritableStream {
  return new Writable({
    write(chunk: Buffer | string, encoding: BufferEncoding, cb: (err?: Error) => void) {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
      const masked = maskSensitive(text);
      inner.write(masked, encoding, cb);
    },
  });
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

```bash
pnpm --filter cli exec vitest run src/utils/sensitiveBlacklist.test.ts
```

Expected: 16 passed (7 + 5 + 4), 0 failed.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/utils/sensitiveBlacklist.ts apps/cli/src/utils/sensitiveBlacklist.test.ts
git commit -m "feat(cli): add wrapWithMasking Writable proxy

Forwards every write() chunk to the inner stream after passing
it through maskSensitive. Used by logger.ts to wrap pino
destinations so sensitive strings never reach smm.log or
browser.log.
"
```

---

## Task 7: Wire `logger.ts` to use the sensitive blacklist

**Files:**
- Modify: `apps/cli/lib/logger.ts`

- [ ] **Step 1: Update imports and the `createLogger` function**

In `apps/cli/lib/logger.ts`:

a) Add an import at the top alongside the existing imports (after line 7):

```ts
import { initSensitiveStrings, wrapWithMasking } from "@/utils/sensitiveBlacklist";
```

b) Add `await initSensitiveStrings()` at the very top of the module, before `createLogger` is called. The simplest place is right after the imports, before the `createLogger` function definition (or right after it, before the `logger` const). Concretely, insert this line immediately after the closing of the `createLogger` function and before the `// Create and export the logger instance` comment:

```ts
await initSensitiveStrings();
```

c) In the file branch of `createLogger` (currently lines 57–68), change the `pino.destination({...})` return value to go through `wrapWithMasking`:

Current:
```ts
    const destination = pino.destination({
      dest: logFilePath,
      append: true,
      sync: false, // Use async writing for better performance
    });

    return pino({
      level: logLevel,
      // Local app — no need for `pid` or `hostname`; `time` alone identifies
      // the moment of emission.
      base: null,
    }, destination);
```

Change to:
```ts
    const destination = wrapWithMasking(
      pino.destination({
        dest: logFilePath,
        append: true,
        sync: false, // Use async writing for better performance
      }),
    );

    return pino({
      level: logLevel,
      // Local app — no need for `pid` or `hostname`; `time` alone identifies
      // the moment of emission.
      base: null,
    }, destination);
```

d) In the console branch of `createLogger` (currently lines 69–75), replace the implicit stdout destination with an explicit one wrapped by `wrapWithMasking`:

Current:
```ts
  } else {
    // Console logging (default)
    return pino({
      level: logLevel,
      base: null,
    });
  }
```

Change to:
```ts
  } else {
    // Console logging (default). Use an explicit stdout destination so we
    // can apply the same masking wrapper as the file branch — keeps
    // console output consistent with what's persisted to disk.
    const destination = wrapWithMasking(pino.destination(1));
    return pino({
      level: logLevel,
      base: null,
    }, destination);
  }
```

e) In the `frontendLogger` export (currently lines 178–183), wrap the stream:

Current:
```ts
export const frontendLogger = pino(
  { level: process.env.LOG_LEVEL ?? "info", base: null },
  // pino accepts any Node Writable as a destination; rotating-file-stream
  // implements that interface.
  createFrontendLogStream() as unknown as pino.DestinationStream
);
```

Change to:
```ts
export const frontendLogger = pino(
  { level: process.env.LOG_LEVEL ?? "info", base: null },
  // pino accepts any Node Writable as a destination; rotating-file-stream
  // implements that interface. The masking wrapper makes sure sensitive
  // strings never reach browser.log on disk.
  wrapWithMasking(
    createFrontendLogStream() as unknown as NodeJS.WritableStream,
  ) as unknown as pino.DestinationStream,
);
```

The final file should match (the rest is unchanged):

```ts
import pino from 'pino';
import { getLogDir } from '@/utils/config';
import path from 'path';
import { mkdir } from 'fs/promises';
import type { Context } from 'hono';
import os from 'os';
import { createFrontendLogStream } from '@/utils/FrontendLogFile';
import { initSensitiveStrings, wrapWithMasking } from '@/utils/sensitiveBlacklist';

export function maskOsUsername(msg: string): string {
  const username = os.userInfo().username;
  if (!username) {
    return msg;
  }
  return msg.replace(new RegExp(escapeRegExp(username), 'g'), '***');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createLogger() {
  const logTarget = process.env.LOG_TARGET?.toLowerCase().trim() || 'console';
  const logLevel = process.env.LOG_LEVEL || 'info';

  if (logTarget === 'file') {
    const logDir = getLogDir();
    await mkdir(logDir, { recursive: true });
    const logFilePath = path.join(logDir, 'smm.log');

    console.log(`📝 Log directory: ${logDir}`);
    console.log(`📄 Log file: ${logFilePath}`);

    const destination = wrapWithMasking(
      pino.destination({
        dest: logFilePath,
        append: true,
        sync: false,
      }),
    );

    return pino({
      level: logLevel,
      base: null,
    }, destination);
  } else {
    const destination = wrapWithMasking(pino.destination(1));
    return pino({
      level: logLevel,
      base: null,
    }, destination);
  }
}

export function logHttpReqIn(c: Context, body?: unknown) {
  // ... unchanged ...
}

export function logHttpRespOut(c: Context, body: unknown, statusCode: number = 200) {
  // ... unchanged ...
}

export function logHttpReqOut(url: string, method: string = 'GET', body?: unknown) {
  // ... unchanged ...
}

export function logHttpRespIn(url: string, statusCode: number, body?: unknown) {
  // ... unchanged ...
}

await initSensitiveStrings();

export const logger = await createLogger();
logger.debug(`pino: log level is ${logger.level}`)

export const frontendLogger = pino(
  { level: process.env.LOG_LEVEL ?? "info", base: null },
  wrapWithMasking(
    createFrontendLogStream() as unknown as NodeJS.WritableStream,
  ) as unknown as pino.DestinationStream,
);

export default logger;

export function logWithTrace(level, traceId, message, data?) {
  logger[level]({ traceId, ...data }, message);
}

export function createTraceLogger(traceId: number) {
  return logger.child({ traceId });
}
```

(The unchanged middle section — `logHttpReqIn`/`logHttpRespOut`/`logHttpReqOut`/`logHttpRespIn` — is preserved verbatim.)

- [ ] **Step 2: Verify the file is well-formed**

```bash
pnpm --filter cli run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run all CLI tests to ensure no regression**

```bash
pnpm --filter cli test
```

Expected: all existing tests pass + the 16 new tests in `sensitiveBlacklist.test.ts`. The `Log.test.ts` suite in particular should still pass — the route handler is unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/lib/logger.ts
git commit -m "feat(cli): mask sensitive strings in all pino destinations

Wraps the file and console destinations for the main logger, plus
the frontend log stream for frontendLogger, with wrapWithMasking.
Calls await initSensitiveStrings() at module load so the blacklist
is populated before any log line is written.
"
```

---

## Task 8: Final regression check

**Files:** (none)

- [ ] **Step 1: Run the full test suite for both apps**

```bash
pnpm --filter cli test && pnpm --filter ui test
```

Expected: both succeed with 0 failures. CLI shows the 16 new tests in `sensitiveBlacklist.test.ts`; UI shows the 12 new tests in `redactUserConfig.test.ts`.

- [ ] **Step 2: Run typecheck on both apps**

```bash
pnpm --filter cli run typecheck && pnpm --filter ui run typecheck
```

Expected: both exit code 0.

- [ ] **Step 3: Confirm the four commits are in place**

```bash
git log --oneline -8
```

Expected: the four feature commits from this plan appear on top of `3224aafe docs: log sensitive redaction design spec`:
- `feat(ui): add redactUserConfig helper`
- `fix(ui): redact UserConfig api keys in AppLanguageSync log`
- `fix(ui): redact UserConfig api keys in useReloadAppConfig log`
- `feat(cli): add sensitiveString blacklist and maskSensitive`
- `feat(cli): init sensitive blacklist from hostname + smm.json`
- `feat(cli): add wrapWithMasking Writable proxy`
- `feat(cli): mask sensitive strings in all pino destinations`

(That's 7 commits. The plan ends here — pushing to origin is a user-level action and is not part of this plan.)
