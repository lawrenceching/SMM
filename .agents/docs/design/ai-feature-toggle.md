# AI Feature Toggle

Add a master feature toggle `isAiFeatureEnabled` to control all AI-related components/functionality.

[ ] New UI component
[ ] New user config
[ ] Electron only
[ ] User document

## 1. Background

The application has growing AI capabilities including an AI Assistant chat overlay, AI-based episode recognition prompts, and AI-based file renaming prompts. There is currently no single toggle to disable all AI features at once. The user wants a master switch that can hide all AI-related components from the UI.

## 2. Project Level Architecture

None — all changes are within `apps/ui`.

## 3. App Level Architecture

### Changes

**`apps/ui/src/hooks/useFeatures.ts`**
- Add `isAiFeatureEnabled` toggle with default `true`, persisted in localStorage under key `features.isAiFeatureEnabled`
- Export getter/setter in `UseFeaturesResult`

**`apps/ui/src/AppV2.tsx`**
- Gate `<Assistant />` AI chat overlay with `isAiFeatureEnabled`

**`apps/ui/src/components/TvShowPanelPrompts.tsx`**
- Gate `<AiBasedRecognizePrompt />` with `isAiFeatureEnabled`
- Gate `<AiBasedRenameFilePrompt />` with `isAiFeatureEnabled`

**`apps/ui/src/components/TvShowPanel.tsx`**
- Gate AI-based prompt logic (opening/closing AiBasedRecognizePrompt, AiBasedRenameFilePrompt) with `isAiFeatureEnabled`

**`apps/ui/src/components/TvShowPanelUtils.ts`**  
- Skip opening AiBasedRecognizePrompt in `handlePendingPlans` when AI features are disabled

### Affected AI Features

| Feature | Component | Gated by |
|---------|-----------|----------|
| AI Chat Assistant | `<Assistant />` in AppV2.tsx | `isAiFeatureEnabled` |
| AI Recognize Prompt | `<AiBasedRecognizePrompt />` in TvShowPanelPrompts.tsx | `isAiFeatureEnabled` |
| AI Rename Prompt | `<AiBasedRenameFilePrompt />` in TvShowPanelPrompts.tsx | `isAiFeatureEnabled` |
| AI Recognize plan handling | `handlePendingPlans` in TvShowPanelUtils.ts | `isAiFeatureEnabled` |
| AI Recognize/Rename store actions | `openAiBasedRecognizePrompt`, `openAiBasedRenameFilePrompt` in TvShowPanel.tsx | `isAiFeatureEnabled` |

When `isAiFeatureEnabled` is `false`, all the above components and logic are hidden/skipped so the user is not aware of any AI feature.

## 4. User Stories

### 4.1 Toggle AI features on/off

* **Given** a user who wants to disable AI features
* **When** they set `isAiFeatureEnabled` to `false` in localStorage
* **Then** all AI components (Assistant, AI-based Recognize, AI-based Rename) are hidden from the UI

### 4.2 Default enabled

* **Given** a new user who has never configured the toggle
* **When** the application loads
* **Then** `isAiFeatureEnabled` defaults to `true` and all AI features are available

## 5. Tasks

### 5.1 New feature toggle

- [x] Add `isAiFeatureEnabled` to `useFeatures.ts` with localStorage persistence, default `true`
- [x] Update `UseFeaturesResult` type

### 5.2 Gate AI components

- [x] Gate `<Assistant />` in `AppV2.tsx`
- [x] Gate AI prompt components in `TvShowPanelPrompts.tsx`
- [x] Gate AI prompt logic in `TvShowPanel.tsx`
- [x] Gate AI plan handling in `TvShowPanelUtils.ts`
- [x] Gate subtitle dialogs and context menus in `MusicPanel` via `LocalFileSubtitleScope`

## 6. Backward Compatibility

None — existing users get `isAiFeatureEnabled = true` by default, so all AI features remain visible.

## 7. Documents

None.

## 8. Post Verification

- [x] Unit tests: Run `pnpm run test` and expect all unit tests succeed
- [x] Build: Run `pnpm run build` and expect build succeed
