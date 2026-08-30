# Core Scrape Parity (TV/Movie × TMDB/TVDB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Expand `apps/core` scrape to match legacy UI (TV|movie × TMDB|TVDB); movies skip thumbnails.

**Architecture:** One runner per task id with type×database dispatch. Golden source: `docs/dev/scrape.md`.

**Tech Stack:** TypeScript, Vitest, TmdbClient, TvdbClient, FsPort, NetworkPort.

## Global Constraints

- Port logic from UI hooks; do not import `apps/ui`.
- Job shape unchanged (`poster|fanart|thumbnails|nfo`).
- Movie: `thumbnails` → `skipped`.
- TDD; red-green for Core tests.

---

### Task 1: Prerequisites + completion

**Files:** `prepareScrapeFolder` / `checkScrapeCompletion` + tests; CLI e2e reject cases.

- [ ] Allow tvshow|movie × TMDB|TVDB
- [ ] Movie completion: poster/fanart/`movie.nfo`; thumbnails=true (force skip)
- [ ] Update Core/CLI tests that rejected movie/TVDB

### Task 2: Poster + fanart dispatch

**Files:** `scrapePoster.ts` / `scrapeFanart.ts` (or extend existing); TvdbClient helpers; tests.

- [ ] Port UI `resolvePosterUrl` / `resolveFanartUrl`
- [ ] Wire TvdbClient extended/artwork-types APIs

### Task 3: Thumbnails

- [ ] TV+TVDB episode images
- [ ] Movie: skip in orchestrator

### Task 4: NFO

- [ ] Port movie TMDB/TVDB + TV TVDB builders/XML into Core
- [ ] Keep existing TV TMDB path

### Task 5: Verify

- [ ] Core unit tests green
- [ ] CLI scrape e2e (TV TMDB + updated rejects)

---

After Core parity: HTTP `POST /api/scrape` + UI v3 (separate follow-up).
