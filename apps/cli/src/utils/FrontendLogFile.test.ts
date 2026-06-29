import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createFrontendLogStream, resolveFrontendLogPath } from "./FrontendLogFile";

describe("FrontendLogFile", () => {
  let prevLogDir: string | undefined;
  let prevRotateSize: string | undefined;
  let prevRotateKeep: string | undefined;
  let tmpLogRoot: string;

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR;
    prevRotateSize = process.env.FRONTEND_LOG_ROTATE_SIZE;
    prevRotateKeep = process.env.FRONTEND_LOG_ROTATE_KEEP;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-frontend-log-"));
    process.env.LOG_DIR = tmpLogRoot;
  });

  afterEach(() => {
    if (prevLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = prevLogDir;
    }
    if (prevRotateSize === undefined) {
      delete process.env.FRONTEND_LOG_ROTATE_SIZE;
    } else {
      process.env.FRONTEND_LOG_ROTATE_SIZE = prevRotateSize;
    }
    if (prevRotateKeep === undefined) {
      delete process.env.FRONTEND_LOG_ROTATE_KEEP;
    } else {
      process.env.FRONTEND_LOG_ROTATE_KEEP = prevRotateKeep;
    }
    if (existsSync(tmpLogRoot)) {
      rmSync(tmpLogRoot, { recursive: true, force: true });
    }
  });

  it("resolves path to frontend.log under LOG_DIR", () => {
    expect(resolveFrontendLogPath()).toBe(path.join(tmpLogRoot, "frontend.log"));
  });

  it("returns a writable stream and writes lines to frontend.log", async () => {
    const stream = createFrontendLogStream();
    stream.write("hello\n");
    stream.write("world\n");
    await new Promise<void>((resolve) => stream.end(resolve));
    expect(existsSync(path.join(tmpLogRoot, "frontend.log"))).toBe(true);
  });

  it("honours FRONTEND_LOG_ROTATE_SIZE override (small for test)", async () => {
    process.env.FRONTEND_LOG_ROTATE_SIZE = "100B";
    const stream = createFrontendLogStream();
    for (let i = 0; i < 50; i++) stream.write(`line-${i}-${"x".repeat(30)}\n`);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await new Promise<void>((resolve) => stream.end(resolve));
    const rotatedFiles = readdirSync(tmpLogRoot).filter(
      (f) => f.startsWith("frontend.log.") && f !== "frontend.log"
    );
    expect(rotatedFiles.length).toBeGreaterThanOrEqual(1);
  });
});
