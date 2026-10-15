import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { HelloOptions } from "./hello.ts";
import type { CoreRoutesConfig } from "./types.ts";
import { doGetUserConfig, doPatchUserConfig } from "./userConfigApi.ts";

function configFor(userDataDir: string): CoreRoutesConfig {
  return {
    allowlist: [],
    hello: { userDataDir } as HelloOptions,
  };
}

describe("user config HTTP handlers", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "smm-user-config-api-"));
    dirs.push(dir);
    return dir;
  }

  it("returns the default document when smm.json is missing", async () => {
    const dir = await makeDir();
    const result = await doGetUserConfig(configFor(dir));
    expect(result.error).toBeUndefined();
    expect(result.data?.folders).toEqual([]);
    expect(result.data?.tmdb).toEqual({});
    expect(result.data?.tvdb).toEqual({});
    expect(result.data?.renameRules).toEqual([]);
    expect(result.data?.dryRun).toBe(false);
    expect(result.data?.selectedRenameRule).toBe("plex");
  });

  it("returns the persisted config", async () => {
    const dir = await makeDir();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      path.join(dir, "smm.json"),
      JSON.stringify({ folders: ["/media/a"], dryRun: true, tmdb: {}, tvdb: {}, renameRules: [], selectedRenameRule: "plex" }),
      "utf-8",
    );
    const result = await doGetUserConfig(configFor(dir));
    expect(result.data?.folders).toEqual(["/media/a"]);
    expect(result.data?.dryRun).toBe(true);
  });

  it("applies a field patch and persists smm.json with default fields", async () => {
    const dir = await makeDir();
    const result = await doPatchUserConfig(
      { patch: [{ op: "add", path: "/ytdlpProxy", value: "http://127.0.0.1:7890" }] },
      configFor(dir),
    );
    expect(result.error).toBeUndefined();
    expect(result.data?.ytdlpProxy).toBe("http://127.0.0.1:7890");
    expect(result.data?.folders).toEqual([]);
    const saved = JSON.parse(await readFile(path.join(dir, "smm.json"), "utf-8")) as {
      ytdlpProxy: string;
      folders: string[];
    };
    expect(saved.ytdlpProxy).toBe("http://127.0.0.1:7890");
    expect(saved.folders).toEqual([]);
  });

  it("rejects a root replace and does not create smm.json", async () => {
    const dir = await makeDir();
    const result = await doPatchUserConfig(
      { patch: [{ op: "replace", path: "", value: { dryRun: true } }] },
      configFor(dir),
    );
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("not allowed");
    await expect(readFile(path.join(dir, "smm.json"), "utf-8")).rejects.toThrow();
  });

  it("returns an error when userDataDir is not configured", async () => {
    const result = await doGetUserConfig({ allowlist: [] });
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("userDataDir");
  });
});
