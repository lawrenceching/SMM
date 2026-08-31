#!/usr/bin/env bun
/**
 * Fail if apps/ui/src/lib still contains domain modules that should be imported
 * from `@smm/core/pipeline/*` (Problem A). UI-only adapters use a *Ui.ts suffix.
 */
import { readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const uiLib = join(root, "apps/ui/src/lib");

/** Shared domain modules — must live in apps/core/src/pipeline, not duplicated in UI lib. */
const FORBIDDEN_UI_COPIES = new Set([
  "mediaFilePathEqual.ts",
  "renameRules.ts",
  "assetImageUrls.ts",
  "findAssociatedFiles.ts",
  "buildTvShowRenamePlanFileEntries.ts",
  "buildTvShowRenameListForPlan.ts",
  "recognizeEpisodes.ts",
]);

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "nfo" || name === "scrapeDialog" || name === "whitelistedCmd" || name === "ytdlp") {
        continue;
      }
      listTsFiles(full, acc);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".worker.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

const violations: string[] = [];
for (const file of listTsFiles(uiLib)) {
  const base = basename(file);
  if (FORBIDDEN_UI_COPIES.has(base)) {
    violations.push(relative(root, file));
  }
}

if (violations.length > 0) {
  console.error(
    "Forbidden: UI lib files that duplicate @smm/core/pipeline modules (Problem A).\n" +
      "Import from @smm/core/pipeline/* or use a *Ui.ts adapter.\n\n" +
      violations.map((v) => `  - ${v}`).join("\n"),
  );
  process.exit(1);
}

console.log("OK: no pipeline-module basename collisions in apps/ui/src/lib");
