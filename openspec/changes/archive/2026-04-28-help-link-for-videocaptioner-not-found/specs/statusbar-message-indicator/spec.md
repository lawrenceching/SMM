## MODIFIED Requirements

### Requirement: Status bar displays typed messages through MessageIndicator
The system SHALL provide a `MessageIndicator` in the status bar that renders message entries using the `Message` structure with fields `title`, optional `link`, and `type` (`info` | `warning` | `error`), including dependency-unavailable diagnostics for features such as VideoCaptioner.

#### Scenario: Typed message list is rendered
- **WHEN** `StatusBar` provides one or more `Message` items to `MessageIndicator`
- **THEN** the indicator renders each message title and preserves optional link metadata for external help navigation

#### Scenario: VideoCaptioner not found message is rendered as error with actionable help link
- **WHEN** UI discovery state indicates VideoCaptioner is unavailable
- **THEN** the status bar includes a `videocaptioner not found` message entry
- **AND** the message `type` is `error`
- **AND** the message `link` is `https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C`
