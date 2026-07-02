# TVShow-Rename.e2e.ts — Focused Rule-Based Rename Test

Date: 2026-07-02
Status: Pending implementation

## Problem

`docs/features.md` line 38-39 lists `TV Show - Rule Based Rename` with TODO status pointing to `TVShow-Rename.e2e.ts`. The existing `TVShow-RenameByPlan.e2e.ts` covers the rename button flow but bundles an "AI then rule" sequence, which makes it hard to read and obscures regressions specific to the rule-based path.

## Goal

Create a focused e2e test that exercises the rule-based rename happy path in isolation:

1. User clicks the header `rename-button`.
2. The app shows a rename preview (`new-video-file` cells) for the recognized episodes.
3. User clicks confirm.
4. The episode table reflects the renamed paths, and the files on disk are actually renamed.

This complements (does not replace) `TVShow-RenameByPlan.e2e.ts`.

## Scope

- Single `describe` / single `it` happy-path scenario.
- Verify two things at the end:
  1. Episode table UI shows the renamed path (e.g. `Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv`).
  2. `fs.readdirSync(folderPath)` no longer contains `S01E01.mkv` / `S01E02.mkv` / `S01E03.mkv`, and the renamed files exist on disk.

## Non-Goals

- AI-based rename flow (already covered by `TVShow-RenameByPlan.e2e.ts`).
- Selective rename via episode checkboxes.
- Cancel / reject rename plan.
- `mediaMetadata.json` `absolutePath` verification.
- Plan-deletion verification after confirm.

## Test Design

**File:** `apps/e2e/test/specs/tv/TVShow-Rename.e2e.ts`

**Fixture reuse:** `folder1` from `test/actions/import-folders.ts` (WATATEN! — 3 .mkv files + jpg / ass / nfo siblings). Metadata preloaded via `importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')` so TMDB data is present and the rename button is enabled.

**Setup / teardown:** Same as `TVShow-Recognize.e2e.ts` — `setup()` with full cleanup in `before`, `cleanup()` with full cleanup in `afterEach`.

**Steps:**

1. Create folder, import with metadata template.
2. Open page, click folder in sidebar, wait for episode table.
3. Click `TvShowPanelCO.renameButton`.
4. Wait until `TvShowPanelCO.newVideoFilePaths.length === 3`.
5. Click `TvShowPanelCO.confirmButton`.
6. Wait until `TvShowPanelCO.toString()` includes the renamed S01E01 path.
7. Assert UI contains all 3 renamed paths.
8. Assert the original `.mkv` files no longer exist in the root folder, and the renamed files exist under `Season 01/`.

**Disk layout after rename:** rule-based rename moves the `.mkv` files into a `Season 01/` subfolder using the show / season / episode / title pattern. So the disk assertion checks two directories:

```ts
const rootFiles = fs.readdirSync(folder.path!)
const season1Files = fs.readdirSync(path.join(folder.path!, 'Season 01'))

// Root: original .mkv files are gone
expect(rootFiles).not.toContain('S01E01.mkv')
expect(rootFiles).not.toContain('S01E02.mkv')
expect(rootFiles).not.toContain('S01E03.mkv')

// Season 01: renamed files exist
expect(season1Files).toEqual(
  expect.arrayContaining([
    'WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
    'WATATEN!: an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv',
    'WATATEN!: an Angel Flew Down to Me - S01E03 - Imprinting.mkv',
  ]),
)
```

Exact filenames match what `TVShow-RenameByPlan.e2e.ts` already verifies for the same fixture.

## Implementation Notes

- Reuse `TvShowPanelCO` (`[data-testid="rename-button"]`, `newVideoFilePaths`, `confirmButton`, `toString()`).
- Reuse `Sidebar` and `page` from `test/pageobjects/page`.
- Mirror the timing of `TVShow-RenameByPlan.e2e.ts`: 90s timeout, 30s wait for 3 preview rows, 15s wait for UI update.
- Update `docs/features.md` line 39: change `TODO` to `AUTO` after the test passes.
