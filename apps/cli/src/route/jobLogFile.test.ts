import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Hono } from "hono";
import { handleJobLogFile } from "./jobLogFile";

describe("GET /api/job-log-file/:jobId", () => {
  let prevLogDir: string | undefined;
  let tmpLogRoot: string;
  let app: Hono;

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-joblog-read-"));
    process.env.LOG_DIR = tmpLogRoot;
    app = new Hono();
    handleJobLogFile(app);
  });

  afterEach(() => {
    if (prevLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = prevLogDir;
    }
    if (existsSync(tmpLogRoot)) {
      rmSync(tmpLogRoot, { recursive: true, force: true });
    }
  });

  it("returns 400 for an unsafe job id", async () => {
    const res = await app.request("/api/job-log-file/not.ok");
    expect(res.status).toBe(400);
  });

  it("returns 404 when the job log file is missing", async () => {
    const res = await app.request("/api/job-log-file/m1abc-0");
    expect(res.status).toBe(404);
  });

  it("returns the job log file as text/plain", async () => {
    const jobId = "m1abc-0";
    const content = [
      "Started to import folder: /m/Show, type: tvshow",
      "Started to recognize folder",
      "Recognized folder: My Show",
      "Completed",
      "",
    ].join("\n");
    writeFileSync(path.join(tmpLogRoot, `job-${jobId}.log`), content);

    const res = await app.request(`/api/job-log-file/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toBe(content);
  });
});
