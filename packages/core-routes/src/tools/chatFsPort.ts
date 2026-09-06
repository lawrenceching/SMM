import { Path } from "@smm/utils/path";
import type { FsPort } from "@smm/core/FsPort";
import type { ChatFs } from "../chatTypes.ts";

function unsupportedFsOperation(name: string): never {
  throw new Error(`${name} is not supported by the plan filesystem adapter`);
}

export function createFsPort(fs: ChatFs): FsPort {
  return {
    async readTextFile(path: string): Promise<string> {
      const value = await fs.readJson(path);
      if (value === null) {
        throw new Error(`File not found: ${path}`);
      }
      return JSON.stringify(value);
    },
    async writeTextFile(path: string, content: string): Promise<void> {
      await fs.writeJson(path, JSON.parse(content) as unknown);
    },
    async writeBinaryFile(): Promise<void> {
      unsupportedFsOperation("writeBinaryFile");
    },
    exists: (path: string) => fs.exists(path),
    isFile: (path: string) => fs.exists(path),
    async listFiles(): Promise<string[]> {
      return unsupportedFsOperation("listFiles");
    },
    async listSubdirectories(): Promise<string[]> {
      return unsupportedFsOperation("listSubdirectories");
    },
    async deleteFile(): Promise<void> {
      unsupportedFsOperation("deleteFile");
    },
    async rename(): Promise<void> {
      unsupportedFsOperation("rename");
    },
    async mkdir(): Promise<void> {
      unsupportedFsOperation("mkdir");
    },
  };
}

export function planPath(appDataDir: string, planId: string): string {
  return new Path(appDataDir, `plans/${planId}.plan.json`).abs("posix");
}
