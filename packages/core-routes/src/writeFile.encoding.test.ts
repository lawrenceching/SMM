import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { doWriteFile } from "./writeFile.ts";

function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

/** Minimal 1×1 JPEG (same bytes as e2e MINIMAL_JPEG). */
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

describe("doWriteFile encoding", () => {
  let dir: string;
  let posixDir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "smm-write-file-enc-"));
    posixDir = toPosix(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes binary bytes when encoding is base64", async () => {
    const filePath = join(dir, "thumb.jpg");
    const result = await doWriteFile(
      {
        path: filePath,
        mode: "overwrite",
        data: MINIMAL_JPEG.toString("base64"),
        encoding: "base64",
      },
      { allowlist: [posixDir] },
    );
    expect(result.error).toBeUndefined();
    const written = await readFile(filePath);
    expect(Buffer.compare(written, MINIMAL_JPEG)).toBe(0);
  });

  it("defaults to utf-8 when encoding is omitted", async () => {
    const filePath = join(dir, "note.txt");
    const result = await doWriteFile(
      { path: filePath, mode: "overwrite", data: "hello" },
      { allowlist: [posixDir] },
    );
    expect(result.error).toBeUndefined();
    expect(await readFile(filePath, "utf-8")).toBe("hello");
  });

  it("rejects invalid base64 when encoding is base64", async () => {
    const filePath = join(dir, "bad.bin");
    const result = await doWriteFile(
      {
        path: filePath,
        mode: "overwrite",
        data: "%%%not-base64%%%",
        encoding: "base64",
      },
      { allowlist: [posixDir] },
    );
    expect(result.error).toMatch(/base64/i);
  });
});
