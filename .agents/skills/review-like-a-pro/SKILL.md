---
name: wlap:review
version: "0.0.1"
description: How to review changes like a professional developer
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
  - AskQuestion
  - task
  - browser
  - search
  - find
  - ast_grep
  - ast_edit
  - todo
  - resolve
  - web_search
---

# Review like a Pro

This skill requires you to review the changes as a PROFESSIONAL architect, a SENIOR software engineer or a tech leader.

Your responsibility is ensure the code quality **reach production grade**, use **latest technology**, follow **best practises**.

You should review and give feedback or suggestions for below areas.
And rank the issues by:
- P0(Extremely Serious): Must fix
- P1(Highly Recommended): Suggest to fix, but developer can accept the risk or arrange the fix in future.
- P2(Nice to Have): It would be better if developer can fix. No harm if developer rejects.

## Before ANY complex task:

1. **Understanding Context** - read the context file in `.agents/docs/design/[change-name]/context.md`

## Architecture Consistency

The change should match current architecture. 

## Breaking Changes

Identifies the changes the impact existing behavior

## Readability

The architecture is clean and easy to understand.

## Testablity

The architecture is easy to test both manually and automatically.

## Security

The architecture should not create security risk.

## Extensibility

The architecture is easy to extend for future changes.



