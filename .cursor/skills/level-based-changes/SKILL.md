---
name: level-based-changes
description: >-
  Define how to make "task" level changes
  Use when the user says "wp:task"
disable-model-invocation: true
---

# level-based-changes

This project defines 3 level changes:
* task - a small change, generally don't need to adjust spec file
* story - a medium change, generally update part of a spec file
* epic - a big change, require new spec file


## When to use

- User says `level-based-changes`, or "Make a task/story/epic level change"

## Workflow

### Workflow for a Task

1. Find spec relative files in "./superpowers", "./docs", "apps/*/docs"
2. Understand codebase relative to the change
3. Describe the change in conversation, and ask for user approval
4. Make the change, run `pnpm precommit` to check the change
5. Commit and push after user review and approve the change

### Workflow for a Story

1. Find spec relative files in "./superpowers", "./docs", "apps/*/docs"
2. Understand codebase relative to the change
3. Describe the change in conversation, 
   * The sequence flow across "apps/*"
   * The sequence flow within each apps
   * The impacted spec files
   * The impacted tests
   and ask for user approval
4. Make the change
5. Commit and push after user review and approve the change

### Workflow for a Epic

1. Find spec relative files in "./superpowers", "./docs", "apps/*/docs"
2. Understand codebase relative to the change
3. Create spec file in "./docs", ask for user approval. The spec file focus on high level design, and break down into several stories.
5. Make the change
6. Commit and push after user review and approve the change

