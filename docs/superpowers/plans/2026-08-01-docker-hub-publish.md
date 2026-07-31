# Docker Hub Multi-Arch Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish multi-arch (`linux/amd64` + `linux/arm64`) `lawrenceching/smm:latest` (and `:<git-sha>`) to Docker Hub via GHCR-staged intermediates; update operator docs to pull from Hub.

**Architecture:** Final `apps/docker/Dockerfile` accepts build-args for the five intermediate image refs (defaults = local tags). CI pushes multi-arch intermediates to `ghcr.io/<owner>/smm-*:<sha>`, then assembles and pushes the product image to Docker Hub. E2E stays on local `smm:latest`.

**Tech Stack:** Docker Buildx, QEMU, GitHub Actions, GHCR, Docker Hub, Bun tests for Dockerfile contract.

**Spec:** `docs/superpowers/specs/2026-08-01-docker-hub-publish-design.md`

## Global Constraints

- Product image tags: `lawrenceching/smm:latest` and `lawrenceching/smm:<github.sha>` only (no semver in this plan).
- Platforms: `linux/amd64,linux/arm64`.
- Intermediates: GHCR only; not documented for end users.
- Out of scope: `e2e-docker.yml`, e2e compose, `ci/e2e-docker-container.ts` `DOCKER_IMAGE`.
- Secrets required before first successful run: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.
- Job needs `permissions: packages: write` for GHCR.

## File map

| File | Responsibility |
|------|----------------|
| `apps/docker/Dockerfile` | Final assemble; ARG defaults for local intermediate tags |
| `apps/docker/Dockerfile.intermediate-args.test.ts` | Contract test: required ARG defaults present |
| `.github/workflows/build-docker.yml` | Multi-arch publish workflow |
| `docs/docker-install.md` | Operator install via Hub pull |
| `apps/docker/README.md` | Developer note: Hub vs local build |

---

### Task 1: Final Dockerfile build-args + contract test

**Files:**
- Modify: `apps/docker/Dockerfile`
- Create: `apps/docker/Dockerfile.intermediate-args.test.ts`
- Test: same test file via `bun test`

**Interfaces:**
- Consumes: none
- Produces: Dockerfile ARG names (exact):
  - `SMM_CLI_IMAGE` default `smm-cli-build:latest`
  - `SMM_UI_IMAGE` default `smm-ui-build:latest`
  - `SMM_FFMPEG_IMAGE` default `smm-ffmpeg:latest`
  - `SMM_YTDLP_IMAGE` default `smm-ytdlp:latest`
  - `SMM_VIDEOCAPTIONER_IMAGE` default `smm-videocaptioner:latest`
  - `FROM ${SMM_*_IMAGE} AS …` stage names unchanged: `cli`, `ui`, `ffmpeg`, `ytdlp`, `videocaptioner`

- [ ] **Step 1: Write the failing test**

Create `apps/docker/Dockerfile.intermediate-args.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dockerfile = readFileSync(join(import.meta.dir, 'Dockerfile'), 'utf8');

const requiredArgs: Array<{ arg: string; defaultImage: string; stage: string }> = [
  { arg: 'SMM_CLI_IMAGE', defaultImage: 'smm-cli-build:latest', stage: 'cli' },
  { arg: 'SMM_UI_IMAGE', defaultImage: 'smm-ui-build:latest', stage: 'ui' },
  { arg: 'SMM_FFMPEG_IMAGE', defaultImage: 'smm-ffmpeg:latest', stage: 'ffmpeg' },
  { arg: 'SMM_YTDLP_IMAGE', defaultImage: 'smm-ytdlp:latest', stage: 'ytdlp' },
  {
    arg: 'SMM_VIDEOCAPTIONER_IMAGE',
    defaultImage: 'smm-videocaptioner:latest',
    stage: 'videocaptioner',
  },
];

describe('apps/docker/Dockerfile intermediate image args', () => {
  for (const { arg, defaultImage, stage } of requiredArgs) {
    test(`declares ARG ${arg}=${defaultImage} and FROM \${${arg}} AS ${stage}`, () => {
      expect(dockerfile).toContain(`ARG ${arg}=${defaultImage}`);
      expect(dockerfile).toContain(`FROM \${${arg}} AS ${stage}`);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/docker/Dockerfile.intermediate-args.test.ts`

Expected: FAIL (Dockerfile still has hard-coded `FROM smm-cli-build:latest` etc.; missing `ARG SMM_CLI_IMAGE=…`)

- [ ] **Step 3: Update Dockerfile**

Replace the “Intermediate sources” block (lines 21–26) with:

```dockerfile
# Intermediate sources (override via --build-arg for CI/GHCR multi-arch assemble)
ARG SMM_CLI_IMAGE=smm-cli-build:latest
ARG SMM_UI_IMAGE=smm-ui-build:latest
ARG SMM_FFMPEG_IMAGE=smm-ffmpeg:latest
ARG SMM_YTDLP_IMAGE=smm-ytdlp:latest
ARG SMM_VIDEOCAPTIONER_IMAGE=smm-videocaptioner:latest

FROM ${SMM_CLI_IMAGE} AS cli
FROM ${SMM_UI_IMAGE} AS ui
FROM ${SMM_FFMPEG_IMAGE} AS ffmpeg
FROM ${SMM_YTDLP_IMAGE} AS ytdlp
FROM ${SMM_VIDEOCAPTIONER_IMAGE} AS videocaptioner
```

Keep the header comment that lists local intermediate names; add one line that CI may override with GHCR tags via build-args.

Do **not** change the final `FROM debian:bookworm-slim` stage or `COPY`/`CMD` lines.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/docker/Dockerfile.intermediate-args.test.ts`

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/docker/Dockerfile apps/docker/Dockerfile.intermediate-args.test.ts
git commit -m "$(cat <<'EOF'
feat(docker): allow overriding intermediate images via build-args

EOF
)"
```

---

### Task 2: Rewrite `build-docker.yml` for GHCR intermediates + Hub push

**Files:**
- Modify: `.github/workflows/build-docker.yml` (full replace of job body)

**Interfaces:**
- Consumes: Dockerfile ARG names from Task 1
- Produces: workflow that pushes
  - `ghcr.io/<owner_lc>/smm-cli-build:<sha>`
  - `ghcr.io/<owner_lc>/smm-ui-build:<sha>`
  - `ghcr.io/<owner_lc>/smm-ffmpeg:<sha>`
  - `ghcr.io/<owner_lc>/smm-ytdlp:<sha>`
  - `ghcr.io/<owner_lc>/smm-videocaptioner:<sha>`
  - `lawrenceching/smm:latest`
  - `lawrenceching/smm:<sha>`
- Platforms string: `linux/amd64,linux/arm64`
- Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

- [ ] **Step 1: Replace workflow file contents**

Write `.github/workflows/build-docker.yml` as:

```yaml
name: Build Docker

on:
  # Multi-arch publish is slow; run only via Actions → Run workflow.
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    name: Build and push lawrenceching/smm (multi-arch)
    runs-on: ubuntu-latest
    timeout-minutes: 180
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set image coordinates
        id: meta
        run: |
          set -euo pipefail
          OWNER_LC="$(echo '${{ github.repository_owner }}' | tr '[:upper:]' '[:lower:]')"
          SHA='${{ github.sha }}'
          echo "owner_lc=${OWNER_LC}" >> "$GITHUB_OUTPUT"
          echo "sha=${SHA}" >> "$GITHUB_OUTPUT"
          echo "cli_image=ghcr.io/${OWNER_LC}/smm-cli-build:${SHA}" >> "$GITHUB_OUTPUT"
          echo "ui_image=ghcr.io/${OWNER_LC}/smm-ui-build:${SHA}" >> "$GITHUB_OUTPUT"
          echo "ffmpeg_image=ghcr.io/${OWNER_LC}/smm-ffmpeg:${SHA}" >> "$GITHUB_OUTPUT"
          echo "ytdlp_image=ghcr.io/${OWNER_LC}/smm-ytdlp:${SHA}" >> "$GITHUB_OUTPUT"
          echo "videocaptioner_image=ghcr.io/${OWNER_LC}/smm-videocaptioner:${SHA}" >> "$GITHUB_OUTPUT"

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        # Default docker-container driver — required for multi-platform --push

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push intermediate images
        env:
          PLATFORMS: linux/amd64,linux/arm64
        run: |
          set -euo pipefail
          docker buildx build --platform "$PLATFORMS" --push \
            -t "${{ steps.meta.outputs.cli_image }}" \
            -f apps/docker/cli.Dockerfile .
          docker buildx build --platform "$PLATFORMS" --push \
            -t "${{ steps.meta.outputs.ui_image }}" \
            -f apps/docker/ui.Dockerfile .
          docker buildx build --platform "$PLATFORMS" --push \
            -t "${{ steps.meta.outputs.ffmpeg_image }}" \
            -f apps/docker/ffmpeg.Dockerfile .
          docker buildx build --platform "$PLATFORMS" --push \
            -t "${{ steps.meta.outputs.ytdlp_image }}" \
            -f apps/docker/ytdlp.Dockerfile .
          docker buildx build --platform "$PLATFORMS" --push \
            -t "${{ steps.meta.outputs.videocaptioner_image }}" \
            -f apps/docker/videocaptioner.Dockerfile .

      - name: Assemble and push lawrenceching/smm
        env:
          PLATFORMS: linux/amd64,linux/arm64
        run: |
          set -euo pipefail
          docker buildx build --platform "$PLATFORMS" --push \
            --build-arg "SMM_CLI_IMAGE=${{ steps.meta.outputs.cli_image }}" \
            --build-arg "SMM_UI_IMAGE=${{ steps.meta.outputs.ui_image }}" \
            --build-arg "SMM_FFMPEG_IMAGE=${{ steps.meta.outputs.ffmpeg_image }}" \
            --build-arg "SMM_YTDLP_IMAGE=${{ steps.meta.outputs.ytdlp_image }}" \
            --build-arg "SMM_VIDEOCAPTIONER_IMAGE=${{ steps.meta.outputs.videocaptioner_image }}" \
            -t "lawrenceching/smm:latest" \
            -t "lawrenceching/smm:${{ steps.meta.outputs.sha }}" \
            -f apps/docker/Dockerfile .
```

- [ ] **Step 2: Sanity-check YAML locally (no Actions run required yet)**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/build-docker.yml')); print('ok')"`  
(or `bun -e` with a YAML parser if PyYAML unavailable — prefer any available check)

Expected: prints `ok` / no parse error.

If no YAML library: visually confirm indentation (2 spaces) and that `permissions` is under the workflow root (sibling of `jobs`), not inside a job incorrectly.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-docker.yml
git commit -m "$(cat <<'EOF'
ci(docker): publish multi-arch lawrenceching/smm via GHCR intermediates

EOF
)"
```

---

### Task 3: Operator and developer docs

**Files:**
- Modify: `docs/docker-install.md`
- Modify: `apps/docker/README.md`

**Interfaces:**
- Consumes: published image name `lawrenceching/smm:latest`
- Produces: install docs that prefer Hub pull; local assemble moved to appendix / developer README

- [ ] **Step 1: Rewrite the top of `docs/docker-install.md`**

Replace the “Prerequisites” + “Build the image” sections (through Option B) so the primary path is pull/run. Keep Authentication and later sections, but change every operator-facing `smm:latest` example to `lawrenceching/smm:latest`.

Concrete structure after the intro paragraph:

```markdown
## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10 or newer
- Enough disk space for the image and your media library

The published image supports **linux/amd64** and **linux/arm64**. SMM listens on **port 30000** inside the container.

## Install the image

```bash
docker pull lawrenceching/smm:latest
```

To pin a build, use `lawrenceching/smm:<git-sha>` from the GitHub Actions run that published it.

## Run the container

### Minimal example

```bash
docker run --rm -p 30000:30000 lawrenceching/smm:latest
```
```

Update Recommended example and Compose `image:` to `lawrenceching/smm:latest`.

Move former “Build the image” (pnpm / buildx intermediate steps) to a new section at the **end** of the file (or before any appendix already present):

```markdown
## Build from source (developers)

Prefer the published image above for production. To assemble locally from this monorepo, see [`apps/docker/README.md`](../apps/docker/README.md).
```

Do not duplicate the full build command list in `docs/docker-install.md` if `apps/docker/README.md` already has them — one short pointer is enough.

- [ ] **Step 2: Update `apps/docker/README.md` intro**

After the first paragraph (or under “构建与运行”), add:

```markdown
**Published image:** [`lawrenceching/smm`](https://hub.docker.com/r/lawrenceching/smm) (`latest` = multi-arch amd64/arm64). Operators should pull from Docker Hub; the scripts below are for local development and CI image assembly.
```

Leave local `pnpm run build:*` / `smm:latest` instructions intact.

- [ ] **Step 3: Commit**

```bash
git add docs/docker-install.md apps/docker/README.md
git commit -m "$(cat <<'EOF'
docs(docker): prefer Docker Hub pull for operators

EOF
)"
```

---

### Task 4: Maintainer checklist (manual; no code)

**Files:** none

- [ ] **Step 1: Ensure Docker Hub secrets exist**

In GitHub → Settings → Secrets and variables → Actions, set:

- `DOCKERHUB_USERNAME` — Hub username that owns `lawrenceching/smm` (or has push rights)
- `DOCKERHUB_TOKEN` — Hub Access Token with write permission to that repo

- [ ] **Step 2: Ensure Hub repository exists**

Create `lawrenceching/smm` on Docker Hub if missing (empty repo is fine; first push creates tags).

- [ ] **Step 3: Run workflow**

Actions → **Build Docker** → Run workflow. Wait for job (expect ~1–3 hours depending on cache/QEMU).

- [ ] **Step 4: Verify Hub + arch**

```bash
docker pull lawrenceching/smm:latest
docker buildx imagetools inspect lawrenceching/smm:latest
```

Expected: inspect lists both `linux/amd64` and `linux/arm64`. Optional: `docker run --rm -p 30000:30000 lawrenceching/smm:latest` and open UI.

- [ ] **Step 5: No commit** (ops only)

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Dockerfile build-args with local defaults | Task 1 |
| Multi-arch intermediates → GHCR `:<sha>` | Task 2 |
| Push `lawrenceching/smm:latest` + `:<sha>` | Task 2 |
| Secrets + `packages: write` | Task 2 + Task 4 |
| Operator docs Hub pull | Task 3 |
| E2e unchanged | (no task — intentional) |
| Manual publish verification | Task 4 |

## Placeholder scan

No TBD/TODO steps; workflow and Dockerfile snippets are complete.
