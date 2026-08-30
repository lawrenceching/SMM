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

  it("writes binary data to disk", async () => {
    const adapter = new NodejsFsAdapter();
    const file = joinPosix(tmpPosix, "image.bin");
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    await adapter.writeBinaryFile(file, data);

    expect(await adapter.exists(file)).toBe(true);
    const onDisk = await fsp.readFile(Path.toPlatformPath(file));
    expect(onDisk).toEqual(Buffer.from(data));
    expect(onDisk.length).toBe(data.length);
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

  it("deletes a file", async () => {
    const adapter = new NodejsFsAdapter();
    const file = joinPosix(tmpPosix, "del.txt");
    await adapter.writeTextFile(file, "hi");
    expect(await adapter.exists(file)).toBe(true);

    await adapter.deleteFile(file);

    expect(await adapter.exists(file)).toBe(false);
  });

  it("deleteFile is idempotent for a missing file", async () => {
    const adapter = new NodejsFsAdapter();
    await expect(adapter.deleteFile(joinPosix(tmpPosix, "nope.txt"))).resolves.toBeUndefined();
  });

  it("creates nested directories", async () => {
    const adapter = new NodejsFsAdapter();
    const dir = joinPosix(tmpPosix, "Season 01");
    await adapter.mkdir(dir);
    expect(await adapter.exists(dir)).toBe(true);
  });

  it("renames a directory on disk", async () => {
    const adapter = new NodejsFsAdapter();
    const from = joinPosix(tmpPosix, "old-dir");
    const to = joinPosix(tmpPosix, "new-dir");
    await fsp.mkdir(Path.toPlatformPath(from));
    await fsp.writeFile(join(Path.toPlatformPath(from), "a.txt"), "x");

    await adapter.rename(from, to);

    expect(await adapter.exists(from)).toBe(false);
    expect(await adapter.exists(joinPosix(to, "a.txt"))).toBe(true);
    expect(await adapter.readTextFile(joinPosix(to, "a.txt"))).toBe("x");
  });
});
