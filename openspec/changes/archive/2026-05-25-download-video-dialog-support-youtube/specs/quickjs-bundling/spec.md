## ADDED Requirements

### Requirement: QuickJS binary is downloaded and packaged for all platforms

The CI pipeline SHALL download the QuickJS binary for each target platform and package it into the Electron app at `resources/bin/quickjs/`.

The zip contents SHALL be extracted flat (no version-numbered subdirectory) so the binary is accessible at `bin/quickjs/qjs` (or `bin/quickjs/qjs.exe` on Windows).

#### Scenario: Windows x64 QuickJS download

- **WHEN** CI runs for platform `win` and arch `x64`
- **THEN** download `quickjs-win-x86_64-2025-09-13.zip` from `https://bellard.org/quickjs/binary_releases/`
- **AND** extract all files from `quickjs-win-x86_64-2025-09-13/` into `bin/quickjs/`
- **AND** `bin/quickjs/qjs.exe` SHALL exist

#### Scenario: Linux x64 QuickJS download

- **WHEN** CI runs for platform `linux` and arch `x64`
- **THEN** download `quickjs-linux-x86_64-2025-09-13.zip` from `https://bellard.org/quickjs/binary_releases/`
- **AND** extract all files from the zip into `bin/quickjs/`
- **AND** `bin/quickjs/qjs` SHALL exist and be executable

#### Scenario: Windows arm64 QuickJS download

- **WHEN** CI runs for platform `win` and arch `arm64`
- **THEN** download `quickjs-cosmo-2025-09-13.zip` from `https://bellard.org/quickjs/binary_releases/`
- **AND** extract all files into `bin/quickjs/`
- **AND** `bin/quickjs/qjs` (cosmo binary) SHALL exist

#### Scenario: Linux arm64 QuickJS download

- **WHEN** CI runs for platform `linux` and arch `arm64`
- **THEN** download `quickjs-cosmo-2025-09-13.zip` from `https://bellard.org/quickjs/binary_releases/`
- **AND** extract all files into `bin/quickjs/`
- **AND** `bin/quickjs/qjs` SHALL exist and be executable

#### Scenario: macOS arm64 QuickJS download

- **WHEN** CI runs for platform `mac` and arch `arm64`
- **THEN** download `quickjs-cosmo-2025-09-13.zip` from `https://bellard.org/quickjs/binary_releases/`
- **AND** extract all files into `bin/quickjs/`
- **AND** `bin/quickjs/qjs` SHALL exist and be executable

### Requirement: QuickJS is included in Electron extraResources

The `electron-builder.yml` SHALL include `bin/quickjs` in `extraResources` for all platforms (win, mac, linux) so it is available at runtime alongside ffmpeg and yt-dlp.

#### Scenario: QuickJS path at runtime

- **WHEN** the Electron app starts
- **THEN** the QuickJS binary SHALL be accessible at `<resourcesPath>/bin/quickjs/qjs` (or `qjs.exe` on Windows)
- **AND** the JS Runtime selection SHALL default to this path
