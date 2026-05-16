## MODIFIED Requirements

### Requirement: Selected format applies to the entire job

When the user confirms download, the created `download-video` background job SHALL store the chosen preset's format expression (if any) on job data. The download Service Worker SHALL pass that value into the **executeCmd yt-dlp download adapter** for **every** video in the job, not via `POST /api/ytdlp/download`.

#### Scenario: Multi-video job uses one expression

- **WHEN** the user downloads multiple episode or collection URLs with the 1080p preset selected
- **THEN** the job data SHALL record `ytdlpFormat` with the 1080p expression string
- **AND** each per-video executeCmd invocation SHALL include the same format expression from job data

#### Scenario: Default format for job

- **WHEN** the user leaves the default preset selected
- **THEN** the job SHALL be created without a format field (or with empty format)
- **AND** each per-video executeCmd download SHALL omit `-f` in yt-dlp args
