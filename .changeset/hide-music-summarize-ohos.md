---
"@smm/ui": patch
---

fix(ohos): hide MusicPanel "Summarize" context-menu item on HarmonyOS

The MusicPanel row right-click "Summarize" item (`LocalFileRow`) was
ungated. The `useFeatures().isAiFeatureEnabled` flag is now read and
the item is hidden when AI features are disabled. The default for
`isAiFeatureEnabled` is now `false` on HarmonyOS (no bundled AI
tools) and `true` on desktop, matching the OHOS no-CLI-tools policy
documented in `.agents/docs/design/harmonyos-integration.md` §6.

The flag is a master switch — it also hides the AI Assistant chat
and AI-based recognize/rename prompts on OHOS, which is the intended
behavior. Existing localStorage `features.isAiFeatureEnabled` values
are preserved, so users who explicitly enabled AI keep their setting.
