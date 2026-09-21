import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { doWriteFile } from "./writeFile.ts";

function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

describe("doWriteFile user config guard", () => {
  let dir: string;
  let posixDir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "smm-write-file-config-"));
    posixDir = toPosix(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects writing smm.json", async () => {
    const configPath = join(dir, "smm.json");
    const result = await doWriteFile(
      { path: configPath, mode: "overwrite", data: '{"dryRun":true}' },
      { allowlist: [posixDir] },
    );
    expect(result.error).toContain("writeFile");
    await expect(readFile(configPath, "utf-8")).rejects.toThrow();
  });
});
