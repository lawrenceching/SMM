# quickjs-availability-check

Proactive QuickJS binary availability check before YouTube download format listing.

## Purpose

Verify that a QuickJS JavaScript runtime binary is discoverable before allowing YouTube video downloads, preventing cryptic yt-dlp failures at download time by surfacing the missing runtime issue at the Go-click stage.

## Requirements

### Requirement: QuickJS availability is checked on Go click for YouTube URLs

When the user clicks "Go" for a YouTube URL, the system SHALL probe whether a QuickJS binary is discoverable (via configured path or auto-discovery). If no QuickJS binary is found, the system SHALL display an error message "无法找到JavaScript运行时" and SHALL disable the Start button.

This check SHALL NOT apply to non-YouTube URLs.

#### Scenario: QuickJS found, listing proceeds normally

- **WHEN** the user clicks "Go" on a YouTube URL
- **AND** a QuickJS binary is discovered (configured or auto-discovered path is non-null)
- **THEN** `--list-formats` SHALL proceed as normal
- **AND** no QuickJS-related error SHALL be shown

#### Scenario: QuickJS not found, error displayed

- **WHEN** the user clicks "Go" on a YouTube URL
- **AND** no QuickJS binary is discoverable (both configured and discovered paths are null)
- **THEN** the dialog SHALL display "无法找到JavaScript运行时"
- **AND** the Start button SHALL be disabled
- **AND** `--list-formats` SHALL NOT be called

#### Scenario: Non-YouTube URL skips QuickJS check

- **WHEN** the user clicks "Go" on a non-YouTube URL (e.g., Bilibili)
- **THEN** the QuickJS availability check SHALL be skipped
- **AND** `--list-formats` SHALL proceed regardless of QuickJS availability

#### Scenario: QuickJS becomes available after re-check

- **WHEN** QuickJS was previously unavailable and the error is displayed
- **AND** the user fixes the issue (e.g., configures a valid path) and clicks "Go" again
- **THEN** the QuickJS check SHALL run again
- **AND** if found, the error SHALL be cleared and Start SHALL be enabled
