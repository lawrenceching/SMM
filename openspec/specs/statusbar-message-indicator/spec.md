# statusbar-message-indicator Specification

## Purpose
TBD - created by archiving change message-indicator-in-statusbar. Update Purpose after archive.
## Requirements
### Requirement: Status bar displays typed messages through MessageIndicator
The system SHALL provide a `MessageIndicator` in the status bar that renders message entries using the `Message` structure with fields `title`, optional `link`, and `type` (`info` | `warning` | `error`).

#### Scenario: Typed message list is rendered
- **WHEN** `StatusBar` provides one or more `Message` items to `MessageIndicator`
- **THEN** the indicator renders each message title and preserves optional link metadata for external help navigation

### Requirement: Actionable badge count highlights warning and error messages
The system SHALL show a red notification badge on the status bar message icon, and the badge count SHALL equal the number of messages whose `type` is `warning` or `error`.

#### Scenario: Info messages do not increase badge count
- **WHEN** all messages are `info` type
- **THEN** the badge count is zero and no warning/error alert count is shown

#### Scenario: Warning and error messages increase badge count
- **WHEN** the message list includes two `error` messages and one `warning` message
- **THEN** the badge count shown on the status icon is `3`

