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
