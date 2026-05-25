## ADDED Requirements

### Requirement: Dialog provides JS Runtime selection in More Options

The DownloadVideoDialog SHALL provide a "JS运行时" checkbox and a runtime dropdown inside the "More Options" collapsible section. The checkbox controls whether `--js-runtimes` is passed to yt-dlp.

The dropdown SHALL list: Deno, Node.js, Bun, QuickJS. The default selection SHALL be QuickJS.

#### Scenario: User enables JS Runtime

- **WHEN** the user expands "More Options" and checks "JS运行时"
- **THEN** a dropdown with runtime options (Deno, Node.js, Bun, QuickJS) SHALL appear
- **AND** QuickJS SHALL be the default selection
- **AND** `--js-runtimes` SHALL be included in the yt-dlp command with the selected runtime and its path

#### Scenario: User disables JS Runtime for non-YouTube video

- **WHEN** the user unchecks "JS运行时" for a non-YouTube video
- **THEN** the dropdown SHALL hide
- **AND** `--js-runtimes` SHALL NOT be passed to yt-dlp

### Requirement: JS Runtime is force-enabled for YouTube

For YouTube videos, the "JS运行时" checkbox SHALL be checked and disabled (user cannot uncheck it). The user SHALL still be able to select a different runtime from the dropdown.

#### Scenario: YouTube video with JS Runtime forced on

- **WHEN** the URL is detected as a YouTube video
- **THEN** the "JS运行时" checkbox SHALL be checked and disabled
- **AND** the runtime dropdown SHALL remain enabled
- **AND** `--js-runtimes` SHALL always be included for YouTube download commands

#### Scenario: Non-YouTube video with optional JS Runtime

- **WHEN** the URL is detected as a non-YouTube video (e.g., Bilibili)
- **THEN** the "JS运行时" checkbox SHALL be enabled and unchecked by default
- **AND** the user MAY check or uncheck it freely

### Requirement: JS Runtime path resolves to bundled QuickJS by default

When QuickJS is selected, the path SHALL default to the bundled QuickJS binary at `<resourcesPath>/bin/quickjs/qjs` (or `qjs.exe` on Windows). For other runtimes (Deno, Node.js, Bun), the path SHALL be the runtime name only (relying on system PATH).

#### Scenario: QuickJS path resolution

- **WHEN** the user selects QuickJS and starts download
- **THEN** the `--js-runtimes` argument SHALL include the full path to the bundled QuickJS binary
