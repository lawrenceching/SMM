## Context

Currently, the GeneralSettings component allows users to configure language, TMDB API settings, and MCP server settings. Users need the ability to specify custom paths to yt-dlp and ffmpeg executables, which are used for media scraping/downloading operations.

The `ytdlpExecutablePath` and `ffmpegExecutablePath` fields already exist in the `UserConfig` type definition in `packages/core/types.ts`, but there are no corresponding UI input fields.

## Goals / Non-Goals

**Goals:**
- Add two new input fields in GeneralSettings UI for executable paths
- Allow users to manually type the path or browse via file picker
- Persist the paths to user config (smm.json)
- Show/hide the save button when there are changes

**Non-Goals:**
- Validate that the executable exists or is runnable (deferred to future enhancement)
- Add UI for other 3rd party tools (focus on yt-dlp and ffmpeg only)
- Implement actual usage of these paths in CLI (only UI/config part)

## Decisions

### UI Component Pattern
- **Decision**: Follow existing GeneralSettings pattern with useState/useMemo hooks
- **Rationale**: Maintains consistency with existing settings components

### File Picker Integration
- **Decision**: Use existing `FilePickerDialog` via `useDialog` hook
- **Rationale**: Reuses existing component, provides consistent UX
- **Alternative considered**: Native `<input type="file">` - rejected because it doesn't support path display well

### Field Grouping
- **Decision**: Add a new section "External Tools" below MCP Server settings
- **Rationale**: Groups related functionality together, separates from other settings

### Placeholder Behavior
- **Decision**: Empty path means use system default (PATH or bundled)
- **Rationale**: Matches existing pattern (empty TMDB host uses public TMDB)

## Risks / Trade-offs

- **No path validation**: Users could enter invalid paths. → Mitigation: Add validation in future enhancement
- **Path format**: Windows vs POSIX paths could cause issues. → Mitigation: Use platform-specific path storage (already handled by Path class)
- **Security**: Entering paths to executables is low risk since they run with user's permissions

## Migration Plan

1. Add state variables for ytdlpExecutablePath and ffmpegExecutablePath
2. Add input fields with browse buttons in new "External Tools" section
3. Update initialValues to load existing config values
4. Update hasChanges detection to include new fields
5. Update handleSave to include new fields in updatedConfig
6. Add translations for new labels (or use existing keys if available)

## Open Questions

- Should we add a "Browse" button next to each input field?
  - Yes.
- Should we validate the path exists when saving?
  - No.
