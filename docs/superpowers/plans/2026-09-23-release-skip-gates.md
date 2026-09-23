# Release Skip Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let maintainers emergency-skip Release orchestrator Dispatch Build / Dispatch Pre Release, and rename `skip_ci_verification` → `skip_gates`.

**Architecture:** Step-level `if:` on dispatch steps in `release-all.yml` so skipped jobs still succeed and the `needs` chain stays intact. Rename the gates skip input across Release / Release Electron / Release Docker. Document in `docs/dev/release.md`.

**Tech Stack:** GitHub Actions YAML, existing `ci/dispatch-and-wait-workflow.sh`, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-09-23-release-skip-gates-design.md`

## Global Constraints

- Scope is orchestrator-only for `skip_build` / `skip_pre_release` (`release-all.yml` only).
- Use **step-level** `if:` for skips — never job-level `if:` that skips entire jobs in this chain.
- Rename workflow input `skip_ci_verification` → `skip_gates`; do **not** rename `skip_verify_ci`.
- Defaults for all new/renamed booleans remain `false`.
- No changes to `ci/dispatch-and-wait-workflow.sh` or Electron/Docker build/publish logic beyond the rename/wiring.

## File map

| File | Responsibility |
|------|----------------|
| `.github/workflows/release.yml` | Rename `skip_ci_verification` → `skip_gates` |
| `.github/workflows/release-docker.yml` | Same rename + audit summary text |
| `.github/workflows/release-all.yml` | Add `skip_build` / `skip_pre_release`; rename `skip_gates`; step-level dispatch skips; summary |
| `docs/dev/release.md` | Document skips and rename |

---

### Task 1: Rename `skip_ci_verification` → `skip_gates` in product release workflows

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/release-docker.yml`

**Interfaces:**
- Consumes: none
- Produces: workflow inputs named `skip_gates` (boolean, default `false`) on both `workflow_dispatch` and `workflow_call`; `verify-ci` uses `skip: ${{ inputs.skip_verify_ci || inputs.skip_gates }}`

- [ ] **Step 1: Baseline grep (expect old name present)**

Run:

```bash
rg -n "skip_ci_verification" .github/workflows/release.yml .github/workflows/release-docker.yml
```

Expected: matches in both files (inputs + `verify-ci` wiring; docker also in `audit-skips`).

- [ ] **Step 2: Update `release.yml`**

Replace every `skip_ci_verification` with `skip_gates`. Keep the existing description text style, e.g.:

```yaml
      skip_gates:
        description: 'Skip Verify CI gates (maintainer emergency only)'
        required: false
        default: false
        type: boolean
```

Apply the same rename under `workflow_call.inputs` (no description required there if none today).

Change verify wire-up to:

```yaml
      skip: ${{ inputs.skip_verify_ci || inputs.skip_gates }}
```

Leave `skip_verify_ci` and `skip_final_publish` untouched.

- [ ] **Step 3: Update `release-docker.yml`**

Same input rename under `workflow_dispatch` and `workflow_call`, same verify wire-up:

```yaml
      skip: ${{ inputs.skip_verify_ci || inputs.skip_gates }}
```

Update `audit-skips` job text:

```yaml
            if [ "${{ inputs.skip_gates }}" = "true" ]; then
              echo "::warning::skip_gates was enabled for this run."
              echo "- **skip_gates**: enabled"
            else
              echo "- **skip_gates**: disabled"
            fi
```

- [ ] **Step 4: Verify rename in these two files**

Run:

```bash
rg -n "skip_ci_verification" .github/workflows/release.yml .github/workflows/release-docker.yml
rg -n "skip_gates" .github/workflows/release.yml .github/workflows/release-docker.yml
```

Expected: first command no matches; second command shows inputs + verify (and docker audit).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml .github/workflows/release-docker.yml
git commit -m "$(cat <<'EOF'
ci: rename skip_ci_verification to skip_gates in product release workflows

EOF
)"
```

---

### Task 2: Add `skip_build` / `skip_pre_release` and rename on Release orchestrator

**Files:**
- Modify: `.github/workflows/release-all.yml`

**Interfaces:**
- Consumes: Task 1 child workflows accept `skip_gates`
- Produces: Release `workflow_dispatch` inputs `skip_build`, `skip_pre_release`, `skip_gates` (all boolean, default `false`); child calls pass `skip_gates`

- [ ] **Step 1: Replace and extend inputs**

In `on.workflow_dispatch.inputs`, replace the old skip block with:

```yaml
      skip_build:
        description: 'Skip Dispatch Build (maintainer emergency only)'
        required: false
        default: false
        type: boolean
      skip_pre_release:
        description: 'Skip Dispatch Pre Release (maintainer emergency only)'
        required: false
        default: false
        type: boolean
      skip_gates:
        description: 'Skip Verify CI gates for both products (maintainer emergency only)'
        required: false
        default: false
        type: boolean
```

Remove `skip_ci_verification` entirely from this file.

- [ ] **Step 2: Gate Dispatch Build with step-level skip**

Keep job `dispatch-build` always running (`needs` unchanged). Replace the single dispatch step with:

```yaml
      - name: Dispatch Build (all platforms) and wait
        if: ${{ !inputs.skip_build }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          bash ci/dispatch-and-wait-workflow.sh build.yml \
            "${{ github.ref_name }}" "${{ github.sha }}"

      - name: Note skipped Build dispatch
        if: ${{ inputs.skip_build }}
        run: |
          echo "::warning::skip_build was enabled; Dispatch Build was skipped."
          echo "- **skip_build**: enabled (Dispatch Build skipped)" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 3: Gate Dispatch Pre Release with step-level skip**

Same pattern on `dispatch-pre-release` (keep `needs: [dispatch-build]`):

```yaml
      - name: Dispatch Pre Release and wait
        if: ${{ !inputs.skip_pre_release }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          bash ci/dispatch-and-wait-workflow.sh pre-release.yml \
            "${{ github.ref_name }}" "${{ github.sha }}"

      - name: Note skipped Pre Release dispatch
        if: ${{ inputs.skip_pre_release }}
        run: |
          echo "::warning::skip_pre_release was enabled; Dispatch Pre Release was skipped."
          echo "- **skip_pre_release**: enabled (Dispatch Pre Release skipped)" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 4: Wire `skip_gates` through verify and child workflows**

```yaml
  verify-ci:
    name: Verify CI gates
    needs: [dispatch-pre-release]
    uses: ./.github/workflows/_verify-ci-gates.yml
    with:
      skip: ${{ inputs.skip_gates }}
    secrets: inherit
```

In `release-electron` and `release-docker` `with:` blocks, replace:

```yaml
      skip_ci_verification: ${{ inputs.skip_ci_verification }}
```

with:

```yaml
      skip_gates: ${{ inputs.skip_gates }}
```

Keep `skip_verify_ci: true` and `skip_final_publish: true` as today.

- [ ] **Step 5: Update `summary` job to list all skips**

Replace the skip portion of the summary script so it reports each flag. Example body:

```yaml
        run: |
          {
            echo "## Release ${TAG}"
            echo ""
            echo "| Product | Result |"
            echo "|---------|--------|"
            echo "| Electron | ${{ needs.release-electron.result }} |"
            echo "| Docker | ${{ needs.release-docker.result }} |"
            echo "| Publish | ${{ needs.publish.result }} |"
            echo ""
            echo "**Tag:** \`${TAG}\`"
            echo "**Commit:** \`${SHA}\`"
            echo ""
            echo "### Skip options"
            if [ "${SKIP_BUILD}" = "true" ] || [ "${SKIP_PRE_RELEASE}" = "true" ] || [ "${SKIP_GATES}" = "true" ]; then
              echo ""
              echo "::warning::One or more Release skip options were enabled for this run."
            fi
            echo "- **skip_build**: ${SKIP_BUILD}"
            echo "- **skip_pre_release**: ${SKIP_PRE_RELEASE}"
            echo "- **skip_gates**: ${SKIP_GATES}"
          } >> "$GITHUB_STEP_SUMMARY"
        env:
          TAG: ${{ inputs.tag_name }}
          SHA: ${{ github.sha }}
          SKIP_BUILD: ${{ inputs.skip_build }}
          SKIP_PRE_RELEASE: ${{ inputs.skip_pre_release }}
          SKIP_GATES: ${{ inputs.skip_gates }}
```

- [ ] **Step 6: Verify orchestrator YAML**

Run:

```bash
rg -n "skip_ci_verification" .github/workflows/release-all.yml
rg -n "skip_build|skip_pre_release|skip_gates" .github/workflows/release-all.yml
# Ensure no job-level if on dispatch jobs:
rg -n "^  dispatch-build:|^  dispatch-pre-release:|if:.*skip_build|if:.*skip_pre_release" .github/workflows/release-all.yml
```

Expected:

- No `skip_ci_verification`
- All three new input names present
- `if: ${{ !inputs.skip_build }}` / `if: ${{ inputs.skip_build }}` appear under steps, not as a job-level key immediately under `dispatch-build:` / `dispatch-pre-release:`

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/release-all.yml
git commit -m "$(cat <<'EOF'
ci: add Release skip_build / skip_pre_release and use skip_gates

EOF
)"
```

---

### Task 3: Update release documentation

**Files:**
- Modify: `docs/dev/release.md`

**Interfaces:**
- Consumes: final input names from Tasks 1–2
- Produces: docs matching Actions UI

- [ ] **Step 1: Replace all `skip_ci_verification` mentions with `skip_gates`**

Run:

```bash
rg -n "skip_ci_verification" docs/dev/release.md
```

Update each hit (prep text, skip options table, status table) to `skip_gates`, keeping the meaning: skip verifying required checks already passed on the commit.

- [ ] **Step 2: Expand the skip options section**

Replace / extend the “skip 选项” table so it includes orchestrator-only flags. Target content:

```markdown
## skip 选项（Release / Release Docker / Release Electron）

| 选项 | 作用范围 | 风险 | 何时使用 |
|------|----------|------|----------|
| `skip_build: true` | 仅 **Release** 编排的 Dispatch Build | 发版前不再跑一轮全平台 Build 校验 | 紧急发版；须确认近期 Build 可信 |
| `skip_pre_release: true` | 仅 **Release** 编排的 Dispatch Pre Release | 发版前不再跑全套产品 E2E | 偶发不稳定阻塞发版时；须人工判断风险 |
| `skip_gates: true` | Release / Release Electron / Release Docker | 未确认该 commit 上 required CI checks 全绿即发版 | 紧急 hotfix；须在 Release 说明中注明 |

`skip_build` / `skip_pre_release` **不会**跳过 Electron/Docker 子 workflow 内的产品构建与统一 `publish`。

skip 为 true 时，CI summary 会记录该次选择，便于审计。
```

Also update the recommended flow bullet that says Release dispatches Build → Pre Release so it notes these can be skipped via the inputs above.

- [ ] **Step 3: Update status table row**

Change the row that says `` `skip_ci_verification` | 已有 `` to:

```markdown
| `skip_gates` | 已有（所有 Release workflow） |
| `skip_build` / `skip_pre_release` | 已有（仅 **Release** 编排） |
```

- [ ] **Step 4: Verify docs**

Run:

```bash
rg -n "skip_ci_verification" docs/dev/release.md
rg -n "skip_build|skip_pre_release|skip_gates" docs/dev/release.md
```

Expected: no old name; all three new names present.

- [ ] **Step 5: Commit**

```bash
git add docs/dev/release.md
git commit -m "$(cat <<'EOF'
docs: document Release skip_build / skip_pre_release and skip_gates

EOF
)"
```

---

### Task 4: Repo-wide acceptance check

**Files:**
- Verify only (no edits unless a stray reference is found)

- [ ] **Step 1: Confirm no remaining workflow/docs input name**

Run:

```bash
rg -n "skip_ci_verification" .github/workflows docs/dev/release.md
rg -n "skip_build|skip_pre_release|skip_gates" .github/workflows/release-all.yml .github/workflows/release.yml .github/workflows/release-docker.yml docs/dev/release.md
```

Expected:

- First command: no matches (spec/plan history under `docs/superpowers/` may still mention the old name — that is fine; do not rewrite historical specs unless they claim to be current API)
- Second command: all three names appear in `release-all.yml` and docs; `skip_gates` in all three workflows

- [ ] **Step 2: Confirm `skip_verify_ci` untouched**

Run:

```bash
rg -n "skip_verify_ci" .github/workflows/release.yml .github/workflows/release-docker.yml .github/workflows/release-all.yml
```

Expected: still present on product workflows and still passed as `true` from `release-all.yml`.

- [ ] **Step 3: No commit unless Step 1 found stray references that required a fix**

If a fix was needed, commit it:

```bash
git add <fixed-files>
git commit -m "$(cat <<'EOF'
ci: remove leftover skip_ci_verification references

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `skip_build` / `skip_pre_release` on Release only | Task 2 |
| Step-level skip (not job-level) | Task 2 |
| Rename to `skip_gates` on all Release workflows | Tasks 1–2 |
| Do not rename `skip_verify_ci` | Tasks 1–2, verified Task 4 |
| Summary warnings | Tasks 1–2 |
| Docs update | Task 3 |
| Out of scope: dispatch script / publish logic | Not modified |
