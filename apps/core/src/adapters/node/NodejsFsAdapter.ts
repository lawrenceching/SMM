import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { Path } from "@core/path";
import type { FsPort } from "../../ports/FsPort";

/**
 * Node host adapter. Core passes POSIX paths; this adapter converts to the
 * host's platform format before touching node:fs. Node hosts only.
 */
export class NodejsFsAdapter implements FsPort {
  async readTextFile(path: string): Promise<string> {
    return fsp.readFile(Path.toPlatformPath(path), "utf-8");
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const platform = Path.toPlatformPath(path);
    await fsp.mkdir(dirname(platform), { recursive: true });
    await fsp.writeFile(platform, content, "utf-8");
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    const platform = Path.toPlatformPath(path);
    await fsp.mkdir(dirname(platform), { recursive: true });
    await fsp.writeFile(platform, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fsp.access(Path.toPlatformPath(path));
      return true;
    } catch {
      return false;
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await fsp.stat(Path.toPlatformPath(path));
      return stats.isFile();
    } catch {
      return false;
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    const root = Path.toPlatformPath(dir);
    const out: string[] = [];
    const walk = async (current: string): Promise<void> => {
      const entries = await fsp.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          out.push(full);
        }
      }
    };
    await walk(root);
    return out;
  }

  async listSubdirectories(dir: string): Promise<string[]> {
    const root = Path.toPlatformPath(dir);
    const entries = await fsp.readdir(root, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      out.push(join(root, entry.name));
    }
    return out;
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await fsp.unlink(Path.toPlatformPath(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    await fsp.rename(Path.toPlatformPath(from), Path.toPlatformPath(to));
  }

  async mkdir(path: string): Promise<void> {
    await fsp.mkdir(Path.toPlatformPath(path), { recursive: true });
  }
}
