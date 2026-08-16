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

  async exists(path: string): Promise<boolean> {
    try {
      await fsp.access(Path.toPlatformPath(path));
      return true;
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
}
