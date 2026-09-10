# MediaFileTableToolbar Menu API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace caller-built `actions`/`moreItems` with an internalized shared menu driven by `hiddenMenuIds`, `disabledMenuIds`, per-button callbacks, and `externalUrl`.

**Architecture:** `MediaFileTableToolbar` owns menu order, labels, icons, and More overflow. Headers only compute hide/disable sets, wire callbacks, and pass `externalUrl`.

**Tech Stack:** React 19, Vitest, Testing Library, i18next, lucide-react

## Global Constraints

- Follow `docs/superpowers/specs/2026-09-10-media-file-table-toolbar-design.md`
- Keep existing TV e2e test ids: `recognize-button`, `rename-button`, `scrape-button`
- Subtitle test ids use `testIdPrefix` (`tvshow-header` / `movie-header`)
- Shared chrome labels use `tvShow.*` + `mediaPlayer.trackContextMenu.*`
- TDD for toolbar behavior changes; keep header unit tests green (update expectations for shared i18n keys)

---

### Task 1: Redesign MediaFileTableToolbar

**Files:**
- Modify: `apps/ui/src/components/media/MediaFileTableToolbar.tsx`
- Modify: `apps/ui/src/components/media/MediaFileTableToolbar.test.tsx`
- Modify: `apps/ui/src/components/media/MediaFileTableToolbar.stories.tsx`

**Interfaces:**
- Produces: `MediaFileTableMenuId`, props `hiddenMenuIds`, `disabledMenuIds`, per-action callbacks, `externalUrl`, `testIdPrefix`

- [ ] Rewrite toolbar tests for built-in menu + hide/disable
- [ ] Implement built-in menu; remove `actions`/`moreItems`
- [ ] Update Storybook stories
- [ ] Run toolbar unit tests

### Task 2: Thin TvShowPanelHeader

**Files:**
- Modify: `apps/ui/src/components/tv/TvShowPanelHeader.tsx`
- Modify: `apps/ui/src/components/tv/TvShowPanelHeader.test.tsx` (only if needed)

- [ ] Replace action array construction with `hiddenMenuIds`/`disabledMenuIds` + callbacks
- [ ] Pass `externalUrl`, `testIdPrefix="tvshow-header"`
- [ ] Run TV header tests

### Task 3: Thin MovieHeaderV2

**Files:**
- Modify: `apps/ui/src/components/movie/MovieHeaderV2.tsx`
- Modify: `apps/ui/src/components/movie/MovieHeaderV2.test.tsx` (shared `tvShow.openIn*` keys)

- [ ] Same pattern; `hiddenMenuIds` includes `recognize`
- [ ] `testIdPrefix="movie-header"`
- [ ] Run movie header tests

### Task 4: Verify

- [ ] `pnpm --filter ui test` for the three suites
- [ ] `pnpm --filter ui typecheck`
