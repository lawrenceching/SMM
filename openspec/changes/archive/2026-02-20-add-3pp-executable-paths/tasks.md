## 1. Add State Variables

- [x] 1.1 Add ytdlpExecutablePath to initialValues useMemo in GeneralSettings.tsx
- [x] 1.2 Add ffmpegExecutablePath to initialValues useMemo in GeneralSettings.tsx
- [x] 1.3 Create useState hooks for ytdlpExecutablePath and ffmpegExecutablePath

## 2. Load Initial Values

- [x] 2.1 Add useEffect to reset executable path fields when userConfig changes
- [x] 2.2 Add loading of ytdlpExecutablePath and ffmpegExecutablePath from userConfig

## 3. Detect Changes

- [x] 3.1 Update hasChanges useMemo to include ytdlpExecutablePath
- [x] 3.2 Update hasChanges useMemo to include ffmpegExecutablePath

## 4. Handle Save

- [x] 4.1 Update handleSave to include ytdlpExecutablePath in updatedConfig
- [x] 4.2 Update handleSave to include ffmpegExecutablePath in updatedConfig

## 5. Add UI Components

- [x] 5.1 Add "External Tools" section with border-top separator
- [x] 5.2 Add Label and Input for ytdlpExecutablePath
- [x] 5.3 Add Label and Input for ffmpegExecutablePath
- [x] 5.4 Add Browse buttons using useDialog hook
- [x] 5.5 Add appropriate placeholders and data-testid attributes

## 6. Add Translations (if needed)

- [x] 6.1 Add translation keys for new labels in apps/ui/src/lib/i18n/locales/
