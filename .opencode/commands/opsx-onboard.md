---
description: Guided onboarding - walk through a complete OpenSpec workflow cycle with narration
---

Guide the user through their first complete OpenSpec workflow cycle. This is a teaching experience—you'll do real work in their codebase while explaining each step.

## Preflight

Before starting, check if OpenSpec is initialized:
```bash
openspec status --json 2>&1 || echo "NOT_INITIALIZED"
```

**If not initialized:** Tell the user "OpenSpec isn't set up in this project yet. Run `openspec init` first, then come back to `/opsx-onboard`." Stop here.

---

## Phases (follow in order)

1. **Welcome** - Explain you'll walk through a complete change cycle (pick task → explore → create change → artifacts → implement → archive). Time ~15-20 min. Ask what they want to work on.

2. **Task Selection** - Scan codebase for small improvement opportunities (TODO/FIXME, missing error handling, untested functions, type issues, debug artifacts, missing validation). Present 3-4 specific suggestions. If user picks something too large, gently suggest slicing smaller or picking something else.

3. **Explore Demo** - Briefly investigate the relevant code. Use ASCII diagram if helpful. Explain that explore mode (`/opsx-explore`) is for this kind of thinking. **PAUSE** for acknowledgment.

4. **Create the Change** - Run `openspec new change "<derived-name>"`. Show the folder structure (proposal.md, design.md, specs/, tasks.md). Explain these hold the artifacts.

5. **Proposal** - Draft proposal (Why, What Changes, Capabilities, Impact). **PAUSE** for approval. Save to `openspec/changes/<name>/proposal.md`.

6. **Specs** - Create spec(s) under `openspec/changes/<name>/specs/<capability>/spec.md`. Use ADDED Requirements, Requirement:, Scenario: with WHEN/THEN/AND.

7. **Design** - Draft design.md (Context, Goals/Non-Goals, Decisions). Keep it brief for small tasks.

8. **Tasks** - Generate tasks.md with checkboxes. **PAUSE** for user to confirm ready to implement.

9. **Apply (Implementation)** - For each task: announce it, implement, mark complete in tasks.md, brief status. Keep narration light.

10. **Archive** - Move change to `openspec/changes/archive/YYYY-MM-DD-<name>/`. Explain archived changes are project decision history.

11. **Recap** - Summarize the cycle: Explore → New → Proposal → Specs → Design → Tasks → Apply → Archive. Show command reference: `/opsx-explore`, `/opsx-new`, `/opsx-ff`, `/opsx-continue`, `/opsx-apply`, `/opsx-verify`, `/opsx-archive`. Suggest trying `/opsx-new` or `/opsx-ff` on something they want to build.

---

## Graceful handling

- **User wants to stop:** Tell them the change is saved at `openspec/changes/<name>/`. They can use `/opsx-continue` or `/opsx-apply` later. Exit without pressure.
- **User wants command reference only:** Show the OpenSpec Quick Reference table and exit.

## Guardrails

- Follow EXPLAIN → DO → SHOW → PAUSE at key transitions
- Keep narration light during implementation
- Don't skip phases—goal is teaching the workflow
- Use real codebase tasks, not fake examples
- Adjust scope gently but respect user choice
