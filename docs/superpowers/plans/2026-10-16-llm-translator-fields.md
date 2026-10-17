# LLM Translator Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared Configured/Custom LLM credential UI for subtitle translate and process pipeline dialogs.

**Architecture:** Controlled `LlmTranslatorFields` + pure resolve/valid helpers; parents keep confirm payloads as `llm: { apiKey, apiBase?, model? }`.

**Tech Stack:** React 19, shadcn Select/RadioGroup/Input/Label, `useConfig`, i18next, Vitest.

## Global Constraints

- Do not remove `bing` from types/CLI; keep UI hide from prior change.
- Do not persist custom API keys.
- Do not change job/CLI schemas.

---

### Task 1: Pure helpers + unit tests

**Files:**
- Create: `apps/ui/src/lib/llmTranslatorFields.ts`
- Create: `apps/ui/src/lib/llmTranslatorFields.test.ts`

- [x] Export types `LlmTranslatorSourceMode`, `LlmTranslatorFieldsValue`
- [x] `isLlmTranslatorFieldsValid`, `resolveLlmTranslatorPayload`, `createDefaultLlmTranslatorFieldsValue`, `maskApiKey`
- [x] Red-green unit tests

### Task 2: `LlmTranslatorFields` component + i18n

**Files:**
- Create: `apps/ui/src/components/dialogs/LlmTranslatorFields.tsx`
- Create: `apps/ui/src/components/dialogs/LlmTranslatorFields.test.tsx`
- Modify: `apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/components.json` — add `llmTranslatorFields.*`

- [x] Radio Configured/Custom, provider select, read-only vs editable fields
- [x] `useConfig()` for providers; empty-state hint
- [x] Component tests with mocked `useConfig`

### Task 3: Wire dialogs

**Files:**
- Modify: `UISubtitleTranslationDialog.tsx`
- Modify: `UIProcessPipelineDialog.tsx`

- [x] Replace raw LLM inputs with shared component
- [x] Persist mode + provider name in localStorage
- [x] Confirm uses `resolveLlmTranslatorPayload`
- [x] `canConfirm` / `llmOk` use `isLlmTranslatorFieldsValid`

### Task 4: Verify

- [x] `pnpm --filter ui test` (affected) + `pnpm --filter ui typecheck`
