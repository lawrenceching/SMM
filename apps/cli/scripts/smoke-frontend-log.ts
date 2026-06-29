/**
 * End-to-end smoke test for the frontend console streaming pipeline.
 *
 * Boots a real Hono app with handleLog(), POSTs representative frontend
 * payloads (including the "log" level that previously crashed pino), then
 * reads the rotated frontend.log file to verify each entry landed with the
 * expected enriched fields.
 *
 * This is intentionally NOT mocked — it exists to catch regressions that
 * unit tests with vi.fn() mocks miss (e.g. pino msgPrefixSym this-binding).
 *
 * NOTE: ES module imports are hoisted, so we MUST set process.env.LOG_DIR
 * before any import that transitively loads lib/logger.ts (because that
 * module eagerly creates frontendLogger via createFrontendLogStream()).
 * Use dynamic import() to defer module loading until after env is set.
 */
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-smoke-frontend-log-"));
process.env.LOG_DIR = tmpLogRoot;
process.env.LOG_LEVEL = "info";

// All imports deferred until env is set.
const { Hono } = await import("hono");
const { resolveFrontendLogPath } = await import("../src/utils/FrontendLogFile.ts");
const { getLogDir } = await import("../src/utils/config.ts");
const { frontendLogger } = await import("../lib/logger.ts");
const { handleLog, _resetRateLimiterForTests } = await import("../src/route/Log.ts");

console.log("[debug] tmpLogRoot =", tmpLogRoot);
console.log("[debug] getLogDir() =", getLogDir());
console.log("[debug] resolveFrontendLogPath() =", resolveFrontendLogPath());

const logFile = resolveFrontendLogPath();

// Sanity check: does the logger write to a file at all?
console.log("[debug] writing test entry directly via frontendLogger.info()");
frontendLogger.info({ test: true }, "[frontend] direct-test-entry");
await new Promise<void>((resolve) => setTimeout(resolve, 500));
console.log("[debug] tmpLogRoot contents after direct write:", readdirSync(tmpLogRoot));

const app = new Hono();
handleLog(app);

type FetchResult = { status: number; body: unknown };
async function postLog(payload: unknown, headers: Record<string, string> = {}): Promise<FetchResult> {
  const res = await app.request("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let failed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log(`LOG_DIR = ${tmpLogRoot}`);
  _resetRateLimiterForTests();

  // Scenario A: batch with all 5 console levels + "log" level
  console.log("\n[A] batch with log/info/warn/error/debug");
  const sessionId = "smoke-session-" + Date.now();
  const r1 = await postLog({
    entries: [
      { level: "log", message: "console.log says hi", sessionId, ts: 1, url: "https://app.test/home" },
      { level: "info", message: "info entry", sessionId, ts: 2 },
      { level: "warn", message: "warn entry", sessionId, ts: 3 },
      { level: "error", message: "error entry", sessionId, ts: 4 },
      { level: "debug", message: "debug entry", sessionId, ts: 5 },
    ],
    appVersion: "9.9.9-smoke",
  }, { "x-forwarded-for": "203.0.113.5" });
  check("batch 5 entries → 204", r1.status === 204, `got ${r1.status} body=${JSON.stringify(r1.body)}`);

  // Scenario B: oversized payload → 413
  console.log("\n[B] batch too large → 413");
  const tooMany = Array.from({ length: 201 }, (_, i) => ({ level: "info", message: `m-${i}` }));
  const r2 = await postLog({ entries: tooMany, appVersion: "9.9.9-smoke" });
  check("201 entries → 413", r2.status === 413, `got ${r2.status} body=${JSON.stringify(r2.body)}`);

  // Scenario C: invalid body → 400
  console.log("\n[C] invalid body → 400");
  const r3 = await postLog({ entries: [] });
  check("empty entries → 400", r3.status === 400, `got ${r3.status}`);

  // Scenario D: rate limit charges by ceil(N/50) credits → 10/s means
  // a 51-entry batch consumes 2 credits, so 6 such batches saturate the budget.
  console.log("\n[D] rate limit charges per ceil(entries/50)");
  _resetRateLimiterForTests();
  const big = Array.from({ length: 51 }, (_, i) => ({ level: "info", message: `big-${i}` }));
  const r4a = await postLog({ entries: big, appVersion: "9.9.9-smoke" });
  const r4b = await postLog({ entries: big, appVersion: "9.9.9-smoke" });
  const r4c = await postLog({ entries: big, appVersion: "9.9.9-smoke" });
  const r4d = await postLog({ entries: big, appVersion: "9.9.9-smoke" });
  const r4e = await postLog({ entries: big, appVersion: "9.9.9-smoke" });
  const r4f = await postLog({ entries: big, appVersion: "9.9.9-smoke" });
  check("first big batch → 204", r4a.status === 204, `got ${r4a.status}`);
  check("sixth big batch (12 credits > 10/s budget) → 429", r4f.status === 429, `got ${r4f.status} body=${JSON.stringify(r4f.body)}`);

  // Drain — pino flushes asynchronously, give it time
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));

  // Verify file contents
  console.log("\n[E] inspecting frontend.log");
  console.log("[debug] tmpLogRoot contents:", readdirSync(tmpLogRoot));
  console.log("[debug] logFile =", logFile);
  check("frontend.log exists", existsSync(logFile));
  if (!existsSync(logFile)) {
    console.error("Cannot continue — frontend.log not created. Aborting.");
    rmSync(tmpLogRoot, { recursive: true, force: true });
    process.exit(1);
  }
  const contents = readFileSync(logFile, "utf8");
  const lines = contents.split("\n").filter(Boolean);
  check("at least 5 entries written", lines.length >= 5, `got ${lines.length} lines`);

  // Each line is pino JSON; parse and verify enrichment
  const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  const byMsg = new Map<string, Record<string, unknown>>();
  for (const p of parsed) {
    const m = typeof p.msg === "string" ? p.msg : "";
    if (m.startsWith("[frontend] ")) byMsg.set(m.slice("[frontend] ".length), p);
  }

  // Critical: console.log mapped to pino info level
  const logEntry = byMsg.get("console.log says hi");
  check('"log" level mapped to pino "info" (level=30)', logEntry?.level === 30, `got level=${logEntry?.level}`);
  check("source=frontend set on entry", logEntry?.source === "frontend");
  check("appVersion propagated from batch envelope", logEntry?.appVersion === "9.9.9-smoke");
  check("clientIp from x-forwarded-for", logEntry?.clientIp === "203.0.113.5");
  check("clientUrl propagated", logEntry?.clientUrl === "https://app.test/home");
  check("clientTs propagated (epoch ms)", logEntry?.clientTs === 1);
  check("sessionId propagated", logEntry?.sessionId === sessionId);
  check("serverReceivedAt set", typeof logEntry?.serverReceivedAt === "string" && (logEntry.serverReceivedAt as string).length > 0);

  // Verify each non-"log" level hit the right pino level
  const infoEntry = byMsg.get("info entry");
  check("info → pino info (level=30)", infoEntry?.level === 30);
  const warnEntry = byMsg.get("warn entry");
  check("warn → pino warn (level=40)", warnEntry?.level === 40, `got ${warnEntry?.level}`);
  const errorEntry = byMsg.get("error entry");
  check("error → pino error (level=50)", errorEntry?.level === 50);
  const debugEntry = byMsg.get("debug entry");
  if (debugEntry) {
    check("debug → pino debug (level=20)", debugEntry?.level === 20, `got ${debugEntry?.level}`);
  } else {
    console.log("  · debug entry filtered by LOG_LEVEL=info (expected)");
  }

  // cleanup
  rmSync(tmpLogRoot, { recursive: true, force: true });

  if (failed > 0) {
    console.error(`\nSMOKE FAILED: ${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nSMOKE PASSED");
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exit(1);
});