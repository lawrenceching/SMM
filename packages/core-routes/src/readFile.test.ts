import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkFileIsReadable, doReadFile } from "./readFile.ts";

/**
 * Convert a platform-native path to POSIX format (mirrors `Path.posix`).
 * On Windows, "C:\\Users\\x" -> "/C/Users/x". On POSIX, leaves it alone.
 */
function toPosix(p: string): string {
 if (sep === "/") return p;
 return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

describe("checkFileIsReadable", () => {
 let dir: string;

 beforeAll(async () => {
 dir = await mkdtemp(join(tmpdir(), "smm-check-file-readable-"));
 });

 afterAll(async () => {
 await rm(dir, { recursive: true, force: true });
 });

 it("returns the file contents for an existing file", async () => {
 const filePath = join(dir, "hello.txt");
 await writeFile(filePath, "hello world", "utf-8");
 await expect(checkFileIsReadable(filePath)).resolves.toBe("hello world");
 });

 it("returns null for a missing path", async () => {
 await expect(checkFileIsReadable(join(dir, "does-not-exist.txt"))).resolves.toBeNull();
 });

 it("returns null for a path inside a missing directory", async () => {
 await expect(
 checkFileIsReadable(join(dir, "missing-dir", "nested.txt")),
 ).resolves.toBeNull();
 });
});

describe("doReadFile", () => {
 let dir: string;
 let filePath: string;
 let posixDir: string;

 beforeAll(async () => {
 dir = await mkdtemp(join(tmpdir(), "smm-do-read-file-"));
 filePath = join(dir, "sample.txt");
 await writeFile(filePath, "the quick brown fox", "utf-8");
 posixDir = toPosix(dir);
 });

 afterAll(async () => {
 await rm(dir, { recursive: true, force: true });
 });

 it("returns { data } for an existing file in allowlist", async () => {
 const result = await doReadFile({ path: filePath }, { allowlist: [posixDir] });
 expect(result.error).toBeUndefined();
 expect(result.data).toBe("the quick brown fox");
 });

 it("returns { error } for a path outside allowlist (default)", async () => {
 const result = await doReadFile(
 { path: "/definitely/outside/allowlist.txt" },
 { allowlist: [posixDir] },
 );
 expect(result.data).toBeUndefined();
 expect(result.error).toContain("not in the allowlist");
 });

 it("skips allowlist when requireValidPath: false", async () => {
 // Use a platform-native absolute path that is NOT in the allowlist and
 // does not exist on disk. On Windows, use a C: drive path; on POSIX, /
 // is used directly. We avoid POSIX-style /definitely paths because on
 // Windows `Path.toPlatformPath` converts them to UNC paths that hang.
 const outsidePath =
 sep === "/"
 ? "/definitely/outside/allowlist.txt"
 : "C:\\definitely\\outside\\allowlist.txt";
 const result = await doReadFile(
 { path: outsidePath, requireValidPath: false },
 { allowlist: [posixDir] },
 );
 expect(result.error).toContain("File Not Found");
 });

 it("reads an out-of-allowlist file when requireValidPath: false", async () => {
 // Create a file outside the allowlist, then read it with allowlist skipped.
 const outsideDir = await mkdtemp(join(tmpdir(), "smm-do-read-file-outside-"));
 const outsideFile = join(outsideDir, "x.txt");
 await writeFile(outsideFile, "outside-data", "utf-8");

 try {
 const result = await doReadFile(
 { path: outsideFile, requireValidPath: false },
 { allowlist: [posixDir] },
 );
 expect(result.error).toBeUndefined();
 expect(result.data).toBe("outside-data");
 } finally {
 await rm(outsideDir, { recursive: true, force: true });
 }
 });

 it("returns { error: File Not Found } for a missing path", async () => {
 const missingPath = join(dir, "missing.txt");
 const result = await doReadFile(
 { path: missingPath },
 { allowlist: [posixDir] },
 );
 expect(result.data).toBeUndefined();
 expect(result.error).toContain("File Not Found");
 expect(result.error).toContain(missingPath);
 });

 it("returns { error: Validation failed } for empty path", async () => {
 const result = await doReadFile({ path: "" }, { allowlist: [posixDir] });
 expect(result.data).toBeUndefined();
 expect(result.error).toContain("Validation failed");
 });

 it("returns { error: Validation failed } for missing path field", async () => {
 const result = await doReadFile(
 {} as unknown as Parameters<typeof doReadFile>[0],
 { allowlist: [posixDir] },
 );
 expect(result.data).toBeUndefined();
 expect(result.error).toContain("Validation failed");
 });
});
