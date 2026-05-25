## ADDED Requirements

### Requirement: Start button is disabled when QuickJS is unavailable for YouTube

For YouTube URLs, if the QuickJS binary is not discoverable after probing, the Start button SHALL remain disabled even if all other form fields are valid. The user SHALL be shown the error "无法找到JavaScript运行时".

#### Scenario: Start disabled when QuickJS missing

- **WHEN** the URL is YouTube
- **AND** QuickJS binary was probed and not found
- **THEN** the Start button SHALL be disabled
- **AND** the error "无法找到JavaScript运行时" SHALL be visible

#### Scenario: Start enabled when QuickJS is found

- **WHEN** the URL is YouTube
- **AND** QuickJS binary was probed and found
- **THEN** the Start button SHALL be enabled (provided all other validation passes)
