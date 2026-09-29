import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Path } from "@smm/utils/path";
import { NodejsDummyJob } from "./NodejsDummyJob";

describe("NodejsDummyJob", () => {
  let tmpPosix: string;
  let tmpPlatform: string;

  beforeEach(() => {
    tmpPlatform = mkdtempSync(join(tmpdir(), "smm-nodejs-dummy-job-"));
    tmpPosix = Path.posix(tmpPlatform);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tmpPlatform)) {
      rmSync(tmpPlatform, { recursive: true, force: true });
    }
  });

  it("start writes the final log line to a real disk file", async () => {
    // Collapse DummyJob's 1s sleeps so the full start()/run() path stays fast,
    // while NodejsFsAdapter still performs real disk I/O.
    const realSetTimeout = globalThis.setTimeout.bind(globalThis);
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: (...args: unknown[]) => void,
      _ms?: number,
      ...args: unknown[]
    ) => {
      return realSetTimeout(handler, 0, ...args);
    }) as typeof setTimeout);

    const job = new NodejsDummyJob({
      name: "dummy",
      logDir: tmpPosix,
    });

    await job.start();

    const logPath = Path.toPlatformPath(job.logFilePath);
    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, "utf-8")).toBe("dummy completed");
  });
});
