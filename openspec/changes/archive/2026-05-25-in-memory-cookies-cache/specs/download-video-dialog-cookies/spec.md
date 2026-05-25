## ADDED Requirements

### Requirement: Cookie dialog pre-fills from in-memory cache on URL entry

When the user enters a URL whose domain matches a cached cookie entry, the DownloadVideoDialog SHALL pre-fill the cookie fields (text, checkboxes, browser selection) from the cache without requiring the user to re-configure.

#### Scenario: YouTube URL triggers cache pre-fill

- **WHEN** the user types a YouTube URL after having previously configured cookies for youtube.com
- **THEN** the "Use cookies" checkbox SHALL be checked
- **AND** the cookie text SHALL be pre-filled with the cached content
- **AND** the "From browser" and browser selection SHALL match the cached configuration

#### Scenario: Cache pre-fill preserves user edits

- **WHEN** the cache pre-fills cookies for a domain
- **AND** the user manually edits the cookie text or unchecks a box
- **THEN** the user's edits SHALL take precedence over the cached values for the current session
