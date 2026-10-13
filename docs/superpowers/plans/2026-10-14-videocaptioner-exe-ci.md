# VideoCaptioner exe CI in SMM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build VideoCaptioner standalone executables in SMM GitHub Actions (linux on ubuntu-22.04), publish them to SMM GitHub Releases, and point Electron/Docker downloaders at those assets.

**Architecture:** CI clones a pinned upstream `videocaptioner_repo@videocaptioner_ref` into an ephemeral `third_party/videocaptioner` path, optionally applies `ci/videocaptioner/patches/*.patch`, runs upstream `scripts/build_exe.py`, and uploads `videocaptioner-<ver>-<suffix>.tar.gz` to Release tag `videocaptioner-<ver>` on `lawrenceching/SMM`. Consumers construct that URL via a small shared helper.

**Tech Stack:** GitHub Actions, PyInstaller (upstream), Bash (`download-3pp-binary.sh`), Docker (`videocaptioner.Dockerfile`), Bun tests for URL contract.

**Spec:** `docs/superpowers/specs/2026-10-14-videocaptioner-exe-ci-design.md`

## Global Constraints

- SMM releases repo (binary host): `lawrenceching/SMM` (exact `nameWithOwner`).
- Release tag form: `videocaptioner-<videocaptioner_version>` (not bare `<version>`).
- Asset name form: `videocaptioner-<version>-<suffix>.tar.gz` with suffixes `linux-x64` | `linux-arm64` | `win-x64` | `win-arm64` | `mac-arm64`.
- Linux runners: `ubuntu-22.04` (x64) and `ubuntu-22.04-arm` (arm64) for glibc compatibility with Debian bookworm.
- Do not commit VideoCaptioner source into the monorepo.
- Do not push patches to the upstream VideoCaptioner repository.
- First SMM-hosted artifact version: bump `3pp.videocaptioner_version` to `1.0.1` when switching consumers (distinguishes from old upstream-hosted `1.0.0`).
- GPL-3.0: Release notes must cite `videocaptioner_repo@videocaptioner_ref`.
- Commits: only when the human explicitly asks (plan steps still list suggested commit messages for when requested).

## File map

| File | Responsibility |
|------|----------------|
| `package.json` → `3pp` | `videocaptioner_version`, `videocaptioner_ref`, `videocaptioner_repo`, `videocaptioner_releases_repo` |
| `ci/videocaptioner-release-url.ts` | Pure URL builder for Release asset |
| `ci/videocaptioner-release-url.test.ts` | Contract tests for tag + asset URL |
| `ci/download-3pp-binary.sh` | Electron/local 3pp download uses SMM Release URL |
| `apps/docker/videocaptioner.Dockerfile` | Docker 3pp image download uses SMM Release URL |
| `ci/videocaptioner/patches/` | Optional CI-only patches (may be empty) |
| `ci/videocaptioner/README.md` | Maintainer ops: bump ref, patch, run workflow |
| `.github/workflows/build-videocaptioner-exe.yml` | Matrix build + publish Release |
| `apps/electron/docs/pack-external-binaries-plan.md` | Doc: download host is SMM Releases |
| `apps/docker/README.md` | Doc: videocaptioner tarball source |

---

### Task 1: Release URL helper + unit tests

**Files:**
- Create: `ci/videocaptioner-release-url.ts`
- Create: `ci/videocaptioner-release-url.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `videocaptionerReleaseTag(version: string): string` → `videocaptioner-${version}`
  - `videocaptionerReleaseAssetUrl(args: { releasesRepo: string; version: string; suffix: string }): string`

- [ ] **Step 1: Write the failing test**

```typescript
// ci/videocaptioner-release-url.test.ts
import { describe, expect, test } from 'bun:test';
import {
  videocaptionerReleaseAssetUrl,
  videocaptionerReleaseTag,
} from './videocaptioner-release-url';

describe('videocaptionerReleaseTag', () => {
  test('prefixes version', () => {
    expect(videocaptionerReleaseTag('1.0.1')).toBe('videocaptioner-1.0.1');
  });
});

describe('videocaptionerReleaseAssetUrl', () => {
  test('builds SMM Releases download URL', () => {
    expect(
      videocaptionerReleaseAssetUrl({
        releasesRepo: 'lawrenceching/SMM',
        version: '1.0.1',
        suffix: 'linux-x64',
      }),
    ).toBe(
      'https://github.com/lawrenceching/SMM/releases/download/videocaptioner-1.0.1/videocaptioner-1.0.1-linux-x64.tar.gz',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ci/videocaptioner-release-url.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
// ci/videocaptioner-release-url.ts
export function videocaptionerReleaseTag(version: string): string {
  return `videocaptioner-${version}`;
}

export function videocaptionerReleaseAssetUrl(args: {
  releasesRepo: string;
  version: string;
  suffix: string;
}): string {
  const tag = videocaptionerReleaseTag(args.version);
  const asset = `videocaptioner-${args.version}-${args.suffix}.tar.gz`;
  return `https://github.com/${args.releasesRepo}/releases/download/${tag}/${asset}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test ci/videocaptioner-release-url.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (when human asks)**

```bash
git add ci/videocaptioner-release-url.ts ci/videocaptioner-release-url.test.ts
git commit -m "$(cat <<'EOF'
feat(ci): add VideoCaptioner SMM Release asset URL helper

EOF
)"
```

---

### Task 2: Extend `package.json` 3pp metadata

**Files:**
- Modify: `package.json` (`3pp` object only)

**Interfaces:**
- Consumes: none
- Produces `3pp` keys (exact):
  - `videocaptioner_version`: keep `"1.0.0"` until Task 5 (consumer switch + bump)
  - `videocaptioner_ref`: `"2fa280e9425370f02e4e65ea9aff80e71c79a246"` (commit used for upstream 1.0.0 build; adjust if a newer pin is chosen)
  - `videocaptioner_repo`: `"lawrenceching/VideoCaptioner"`
  - `videocaptioner_releases_repo`: `"lawrenceching/SMM"`

- [ ] **Step 1: Write a failing contract test**

Add to `ci/videocaptioner-release-url.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read3pp(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')) as {
    '3pp': Record<string, string>;
  };
  return pkg['3pp'];
}

describe('package.json 3pp videocaptioner keys', () => {
  test('defines ref, source repo, and releases repo', () => {
    const pp = read3pp();
    expect(pp.videocaptioner_ref).toBeTruthy();
    expect(pp.videocaptioner_repo).toMatch(/^[^/]+\/[^/]+$/);
    expect(pp.videocaptioner_releases_repo).toBe('lawrenceching/SMM');
    expect(pp.videocaptioner_version).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ci/videocaptioner-release-url.test.ts`
Expected: FAIL (missing keys)

- [ ] **Step 3: Update `package.json`**

```json
"3pp": {
  "ffmpeg_version": "8.1",
  "ytdlp_version": "2026.07.04",
  "videocaptioner_version": "1.0.0",
  "videocaptioner_ref": "2fa280e9425370f02e4e65ea9aff80e71c79a246",
  "videocaptioner_repo": "lawrenceching/VideoCaptioner",
  "videocaptioner_releases_repo": "lawrenceching/SMM"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test ci/videocaptioner-release-url.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (when human asks)**

```bash
git add package.json ci/videocaptioner-release-url.test.ts
git commit -m "$(cat <<'EOF'
chore(3pp): pin VideoCaptioner source ref and SMM releases repo

EOF
)"
```

---

### Task 3: Patches directory + maintainer README

**Files:**
- Create: `ci/videocaptioner/patches/.gitkeep`
- Create: `ci/videocaptioner/README.md`

**Interfaces:**
- Consumes: `3pp` keys from Task 2
- Produces: documented ops for Task 4 workflow

- [ ] **Step 1: Create empty patches dir**

```bash
mkdir -p ci/videocaptioner/patches
touch ci/videocaptioner/patches/.gitkeep
```

- [ ] **Step 2: Write README**

```markdown
# VideoCaptioner packaging (SMM)

SMM builds VideoCaptioner executables in CI and publishes them to **this**
repo's GitHub Releases. Upstream source is cloned ephemerally; it is not
vendored into git.

## 3pp keys (`package.json`)

| Key | Meaning |
|-----|---------|
| `videocaptioner_version` | Artifact version / Release tag `videocaptioner-<ver>` |
| `videocaptioner_ref` | Upstream git tag or SHA to clone |
| `videocaptioner_repo` | Upstream `owner/repo` to clone |
| `videocaptioner_releases_repo` | Where binaries are downloaded from (`lawrenceching/SMM`) |

## Publish a new build

1. Bump `videocaptioner_version` (and `videocaptioner_ref` if upgrading upstream).
2. Add/refresh patches under `patches/` if needed (`git format-patch` against the pinned ref).
3. Run Actions workflow **Build videocaptioner executables** (`build-videocaptioner-exe.yml`).
4. Confirm Release `videocaptioner-<version>` has five `.tar.gz` assets.
5. Rebuild Docker `smm-videocaptioner` / Electron packs as usual.

## Patches

Patches are applied with `git apply` inside the CI checkout of upstream only.
Never push these commits to the VideoCaptioner repository.
```

- [ ] **Step 3: Commit (when human asks)**

```bash
git add ci/videocaptioner
git commit -m "$(cat <<'EOF'
docs(ci): add VideoCaptioner packaging maintainer notes

EOF
)"
```

---

### Task 4: GitHub Actions workflow `build-videocaptioner-exe.yml`

**Files:**
- Create: `.github/workflows/build-videocaptioner-exe.yml`

**Interfaces:**
- Consumes: `3pp.videocaptioner_version`, `videocaptioner_ref`, `videocaptioner_repo` from `package.json`
- Produces: GitHub Release tag `videocaptioner-<version>` with five assets on `lawrenceching/SMM`

- [ ] **Step 1: Add workflow file**

```yaml
name: Build videocaptioner executables

# Builds PyInstaller bundles from a pinned upstream checkout and publishes
# them to this repository's GitHub Releases (tag videocaptioner-<version>).
on:
  workflow_dispatch:
    inputs:
      force_rerelease:
        description: 'Delete existing Release tag assets and recreate'
        required: false
        default: false
        type: boolean

permissions:
  contents: write

jobs:
  meta:
    name: Read 3pp metadata
    runs-on: ubuntu-22.04
    outputs:
      version: ${{ steps.pp.outputs.version }}
      ref: ${{ steps.pp.outputs.ref }}
      source_repo: ${{ steps.pp.outputs.source_repo }}
    steps:
      - uses: actions/checkout@v4
      - id: pp
        shell: bash
        run: |
          set -euo pipefail
          echo "version=$(node -p "require('./package.json')['3pp'].videocaptioner_version")" >> "$GITHUB_OUTPUT"
          echo "ref=$(node -p "require('./package.json')['3pp'].videocaptioner_ref")" >> "$GITHUB_OUTPUT"
          echo "source_repo=$(node -p "require('./package.json')['3pp'].videocaptioner_repo")" >> "$GITHUB_OUTPUT"

  build:
    name: Build (${{ matrix.target }})
    needs: meta
    runs-on: ${{ matrix.runner }}
    timeout-minutes: 90
    strategy:
      fail-fast: false
      matrix:
        include:
          - runner: windows-latest
            target: win-x64
          - runner: windows-11-arm
            target: win-arm64
          - runner: ubuntu-22.04
            target: linux-x64
          - runner: ubuntu-22.04-arm
            target: linux-arm64
          - runner: macos-latest
            target: mac-arm64
    steps:
      - name: Checkout SMM
        uses: actions/checkout@v4
        with:
          path: smm

      - name: Checkout VideoCaptioner source
        uses: actions/checkout@v4
        with:
          repository: ${{ needs.meta.outputs.source_repo }}
          ref: ${{ needs.meta.outputs.ref }}
          path: third_party/videocaptioner

      - name: Apply SMM patches
        shell: bash
        run: |
          set -euo pipefail
          shopt -s nullglob
          patches=(smm/ci/videocaptioner/patches/*.patch)
          if ((${#patches[@]})); then
            git -C third_party/videocaptioner apply --verbose "${patches[@]}"
          else
            echo "No patches to apply."
          fi

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        working-directory: third_party/videocaptioner
        shell: bash
        run: |
          set -euo pipefail
          python -m pip install --upgrade pip
          pip install pyinstaller
          pip install -e .

      - name: Build executable
        working-directory: third_party/videocaptioner
        shell: bash
        run: |
          set -euo pipefail
          python scripts/build_exe.py --clean --version '${{ needs.meta.outputs.version }}'

      - name: Pack tarball
        shell: bash
        run: |
          set -euo pipefail
          VER='${{ needs.meta.outputs.version }}'
          TARGET='${{ matrix.target }}'
          STAGE=staging/videocaptioner
          rm -rf staging
          mkdir -p "$STAGE"
          cp -a third_party/videocaptioner/dist/videocaptioner/. "$STAGE/"
          chmod +x "$STAGE/videocaptioner" "$STAGE/videocaptioner.exe" 2>/dev/null || true
          tar -czf "videocaptioner-${VER}-${TARGET}.tar.gz" -C staging videocaptioner

      - name: Upload job artifact
        uses: actions/upload-artifact@v4
        with:
          name: videocaptioner-${{ matrix.target }}
          path: videocaptioner-${{ needs.meta.outputs.version }}-${{ matrix.target }}.tar.gz
          if-no-files-found: error

  release:
    name: Publish GitHub Release
    needs: [meta, build]
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: artifacts/
          merge-multiple: true

      - name: Create or refresh Release
        env:
          GH_TOKEN: ${{ github.token }}
          VER: ${{ needs.meta.outputs.version }}
          REF: ${{ needs.meta.outputs.ref }}
          SRC: ${{ needs.meta.outputs.source_repo }}
          FORCE: ${{ inputs.force_rerelease }}
        shell: bash
        run: |
          set -euo pipefail
          TAG="videocaptioner-${VER}"
          NOTES="$(cat <<EOF
          SMM-packaged VideoCaptioner executables.

          - Upstream source: \`${SRC}@${REF}\`
          - License: GPL-3.0 (see upstream repository)
          - Linux builds: ubuntu-22.04 / ubuntu-22.04-arm (glibc compatible with Debian bookworm)
          EOF
          )"
          shopt -s nullglob
          assets=(artifacts/videocaptioner-"${VER}"-*.tar.gz)
          if ((${#assets[@]} != 5)); then
            echo "Expected 5 assets, found ${#assets[@]}:" >&2
            printf '%s\n' "${assets[@]}" >&2
            exit 1
          fi
          if gh release view "$TAG" >/dev/null 2>&1; then
            if [ "$FORCE" != "true" ]; then
              echo "Release $TAG already exists; pass force_rerelease=true to replace assets." >&2
              exit 1
            fi
            gh release delete "$TAG" --yes --cleanup-tag
          fi
          gh release create "$TAG" "${assets[@]}" --title "$TAG" --notes "$NOTES"
```

- [ ] **Step 2: Sanity-check workflow YAML locally**

Run: `python -c "import yaml,pathlib; yaml.safe_load(pathlib.Path('.github/workflows/build-videocaptioner-exe.yml').read_text())"`  
(or `node -e` with a YAML parser if Python PyYAML unavailable)

Expected: parses without error

- [ ] **Step 3: Commit (when human asks)**

```bash
git add .github/workflows/build-videocaptioner-exe.yml
git commit -m "$(cat <<'EOF'
ci: build VideoCaptioner executables and publish to SMM Releases

EOF
)"
```

---

### Task 5: Point consumers at SMM Releases + bump to `1.0.1`

**Prerequisite:** After Task 4 is on `main` (or the working branch), run **Build videocaptioner executables** with `videocaptioner_version` temporarily set to `1.0.1` **or** bump in this task first on the branch, push, run workflow against that commit, then merge consumer changes only once Release `videocaptioner-1.0.1` exists. Do not merge broken download URLs.

**Files:**
- Modify: `package.json` (`videocaptioner_version` → `1.0.1`)
- Modify: `ci/download-3pp-binary.sh`
- Modify: `apps/docker/videocaptioner.Dockerfile`
- Modify: `.github/workflows/build.yml` (hardcoded `VIDEOCAPTIONER_VERSION`)
- Modify: `.github/workflows/release.yml` (hardcoded `VIDEOCAPTIONER_VERSION` occurrences)
- Modify: `.github/workflows/e2e-electron.yml` (hardcoded `VIDEOCAPTIONER_VERSION`)
- Modify: `ci/videocaptioner-release-url.test.ts` (assert Dockerfile/shell URL shape)
- Modify: `apps/electron/docs/pack-external-binaries-plan.md`
- Modify: `apps/docker/README.md` (one-line note if it documents tarball host)

**Interfaces:**
- Consumes: `videocaptionerReleaseAssetUrl` contract; `3pp.videocaptioner_releases_repo`
- Produces: download URL  
  `https://github.com/lawrenceching/SMM/releases/download/videocaptioner-<ver>/videocaptioner-<ver>-<suffix>.tar.gz`

- [ ] **Step 1: Extend tests for consumer URL shape**

Append to `ci/videocaptioner-release-url.test.ts`:

```typescript
describe('consumer download URL shape', () => {
  test('download-3pp-binary.sh uses videocaptioner- tag prefix and releases_repo', () => {
    const sh = readFileSync(join(import.meta.dir, 'download-3pp-binary.sh'), 'utf8');
    expect(sh).toContain('videocaptioner_releases_repo');
    expect(sh).toContain('videocaptioner-${VIDEOCAPTIONER_VERSION}');
    expect(sh).not.toContain('lawrenceching/VideoCaptioner');
  });

  test('videocaptioner.Dockerfile uses videocaptioner- tag prefix', () => {
    const df = readFileSync(
      join(import.meta.dir, '..', 'apps/docker/videocaptioner.Dockerfile'),
      'utf8',
    );
    expect(df).toContain('videocaptioner-${VIDEOCAPTIONER_VERSION}');
    expect(df).toMatch(/VIDEOCAPTIONER_RELEASES_REPO|videocaptioner_releases_repo/);
    expect(df).not.toContain('lawrenceching/VideoCaptioner');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test ci/videocaptioner-release-url.test.ts`
Expected: FAIL on consumer assertions

- [ ] **Step 3: Update `ci/download-3pp-binary.sh`**

Replace the VideoCaptioner URL block (keep ffmpeg/yt-dlp unchanged). Exact intent:

```bash
VIDEOCAPTIONER_VERSION="${VIDEOCAPTIONER_VERSION:-$(node -p "require('./package.json')['3pp'].videocaptioner_version" 2>/dev/null || echo 1.0.1)}"
VIDEOCAPTIONER_RELEASES_REPO="${VIDEOCAPTIONER_RELEASES_REPO:-$(node -p "require('./package.json')['3pp'].videocaptioner_releases_repo" 2>/dev/null || echo lawrenceching/SMM)}"

VC_BASE_URL="https://github.com/${VIDEOCAPTIONER_RELEASES_REPO}/releases/download/videocaptioner-${VIDEOCAPTIONER_VERSION}"
```

Remove `VIDEOCAPTIONER_REPO` as binary host. Update the file header comment accordingly.

- [ ] **Step 4: Update `apps/docker/videocaptioner.Dockerfile`**

```dockerfile
ARG VIDEOCAPTIONER_VERSION=1.0.1
ARG VIDEOCAPTIONER_RELEASES_REPO=lawrenceching/SMM

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar

ARG VIDEOCAPTIONER_VERSION
ARG VIDEOCAPTIONER_RELEASES_REPO
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) VC_SUFFIX=linux-x64 ;; \
      arm64) VC_SUFFIX=linux-arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/${VIDEOCAPTIONER_RELEASES_REPO}/releases/download/videocaptioner-${VIDEOCAPTIONER_VERSION}/videocaptioner-${VIDEOCAPTIONER_VERSION}-${VC_SUFFIX}.tar.gz"; \
    curl -sSLf -o /tmp/vc.tar.gz "$url"; \
    tar -xf /tmp/vc.tar.gz -C /tmp; \
    mkdir -p /output/bin/videocaptioner; \
    cp -a /tmp/videocaptioner/. /output/bin/videocaptioner/; \
    chmod +x /output/bin/videocaptioner/videocaptioner 2>/dev/null || true
```

- [ ] **Step 5: Bump version + hardcoded workflow env**

- `package.json`: `"videocaptioner_version": "1.0.1"`
- Replace `VIDEOCAPTIONER_VERSION: 1.0.0` with `1.0.1` in:
  - `.github/workflows/build.yml`
  - `.github/workflows/release.yml` (all occurrences)
  - `.github/workflows/e2e-electron.yml`

- [ ] **Step 6: Update docs strings**

In `apps/electron/docs/pack-external-binaries-plan.md`, change the videocaptioner bullet to download from  
`https://github.com/lawrenceching/SMM/releases` tag `videocaptioner-<version>`.

- [ ] **Step 7: Publish Release before relying on downloads**

1. Ensure Tasks 1–4 + version `1.0.1` are pushed.
2. Run `build-videocaptioner-exe` workflow.
3. Verify Release `videocaptioner-1.0.1` has five assets.
4. Only then merge/land the consumer URL switch if it was on a branch behind the publish.

- [ ] **Step 8: Run unit tests**

Run: `bun test ci/videocaptioner-release-url.test.ts`
Expected: PASS

- [ ] **Step 9: Bookworm smoke (manual / docker)**

```bash
# after assets exist
TMP=$(mktemp -d)
curl -sSLf -o "$TMP/vc.tar.gz" \
  "https://github.com/lawrenceching/SMM/releases/download/videocaptioner-1.0.1/videocaptioner-1.0.1-linux-x64.tar.gz"
tar -xf "$TMP/vc.tar.gz" -C "$TMP"
docker run --rm -v "$TMP/videocaptioner:/vc:ro" debian:bookworm-slim /vc/videocaptioner --version
```

Expected: version output, **no** `GLIBC_2.38` error  
(On Windows Git Bash, prefer `docker cp` from a downloaded extract or `MSYS_NO_PATHCONV=1` for `-v` mounts.)

- [ ] **Step 10: Commit (when human asks)**

```bash
git add package.json ci/download-3pp-binary.sh apps/docker/videocaptioner.Dockerfile \
  ci/videocaptioner-release-url.test.ts \
  .github/workflows/build.yml .github/workflows/release.yml .github/workflows/e2e-electron.yml \
  apps/electron/docs/pack-external-binaries-plan.md apps/docker/README.md
git commit -m "$(cat <<'EOF'
fix(3pp): fetch VideoCaptioner binaries from SMM Releases (glibc 22.04 builds)

EOF
)"
```

---

### Task 6: Wire `build-videocaptioner.yml` build-arg name (optional consistency)

**Files:**
- Modify: `.github/workflows/build-videocaptioner.yml` only if it passes `VIDEOCAPTIONER_REPO` (today it only passes `VIDEOCAPTIONER_VERSION` — verify and skip if unchanged).

- [ ] **Step 1: Read workflow**

Confirm it does not pass obsolete `VIDEOCAPTIONER_REPO`. If clean, mark task done with no code change.

- [ ] **Step 2: If Dockerfile ARG rename requires it, pass**

```yaml
--build-arg "VIDEOCAPTIONER_VERSION=${VC_VERSION}" \
--build-arg "VIDEOCAPTIONER_RELEASES_REPO=lawrenceching/SMM" \
```

(Default in Dockerfile already covers this; explicit build-arg only if CI must override.)

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| CI clone + optional patch + PyInstaller | Task 4 |
| linux on ubuntu-22.04 | Task 4 matrix |
| Publish to SMM Releases tag `videocaptioner-<ver>` | Task 4 release job |
| Asset naming unchanged suffix set | Task 4 pack step + Task 1 URL helper |
| `3pp` ref / repo / releases_repo | Task 2 |
| `download-3pp-binary.sh` + Dockerfile URL switch | Task 5 |
| No VC source in git | Tasks 3–4 (ephemeral checkout) |
| Bookworm glibc smoke | Task 5 Step 9 |
| GPL / release notes cite repo@ref | Task 4 NOTES |
| Maintainer docs | Task 3 README + Task 5 electron/docker docs |

## Placeholder scan

None intentional. `ubuntu-22.04-arm` must exist on GitHub-hosted runners at implementation time; if missing, replace with the current GH-documented Ubuntu 22.04 ARM runner label and note in workflow comments.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-14-videocaptioner-exe-ci.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
