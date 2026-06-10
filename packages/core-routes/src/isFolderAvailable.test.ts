import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
 checkFolderPathAvailable,
 doIsFolderAvailable,
} from "./isFolderAvailable.ts";

describe("checkFolderPathAvailable", () => {
 let dir: string;

 beforeAll(async () => {
 dir = await mkdtemp(join(tmpdir(), "smm-is-folder-available-"));
 });

 afterAll(async () => {
 await rm(dir, { recursive: true, force: true });
 });

 it("returns true for an existing directory", async () => {
 await expect(checkFolderPathAvailable(dir)).resolves.toBe(true);
 });

 it("returns false for a missing path", async () => {
 await expect(checkFolderPathAvailable(join(dir, "does-not-exist"))).resolves.toBe(false);
 });

 it("returns false when path is a file", async () => {
 const filePath = join(dir, "not-a-dir.txt");
 const fh = await open(filePath, "w");
 await fh.close();
 await expect(checkFolderPathAvailable(filePath)).resolves.toBe(false);
 });
});

describe("doIsFolderAvailable", () => {
 let dir: string;

 beforeAll(async () => {
 dir = await mkdtemp(join(tmpdir(), "smm-is-folder-available-pure-"));
 });

 afterAll(async () => {
 await rm(dir, { recursive: true, force: true });
 });

 it("returns available true for an existing directory", async () => {
 await expect(doIsFolderAvailable({ path: dir })).resolves.toEqual({ available: true });
 });

 it("returns available false for a missing path", async () => {
 await expect(doIsFolderAvailable({ path: join(dir, "nope") })).resolves.toEqual({ available: false });
 });

 it("returns available false when path is a file", async () => {
 const filePath = join(dir, "not-a-dir.txt");
 const fh = await open(filePath, "w");
 await fh.close();
 await expect(doIsFolderAvailable({ path: filePath })).resolves.toEqual({ available: false });
 });

 it("returns available false for an empty path", async () => {
 await expect(doIsFolderAvailable({ path: "" })).resolves.toEqual({ available: false });
 });

 it("returns available false when path is missing from the body", async () => {
 await expect(
 doIsFolderAvailable({} as unknown as Parameters<typeof doIsFolderAvailable>[0]),
 ).resolves.toEqual({ available: false });
 });
});
