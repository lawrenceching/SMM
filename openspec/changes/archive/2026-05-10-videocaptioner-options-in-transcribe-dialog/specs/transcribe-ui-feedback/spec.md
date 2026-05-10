## MODIFIED Requirements

### Requirement: Transcribe action is disabled when VideoCaptioner is unavailable

The system SHALL disable the `Transcribe` action in `MusicFileTable` context menu when **both** VideoCaptioner discovery reports unavailable **and** Tencent ASR transcription is not enabled for the application.

#### Scenario: Transcribe is disabled when neither VideoCaptioner nor Tencent path is available

- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is unavailable **and** Tencent ASR transcription is not enabled for the application
- **THEN** the `Transcribe` menu item is shown as disabled
- **AND** selecting the disabled item does not open **`TranscribeDialog`** or enqueue any transcribe background job

#### Scenario: Transcribe is enabled when VideoCaptioner is available

- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is available
- **THEN** the `Transcribe` menu item is enabled
- **AND** selecting it opens **`TranscribeDialog`** when the target track has a resolvable **`path`**, consistent with music panel transcribe entry points

#### Scenario: Transcribe is enabled when Tencent ASR is enabled without VideoCaptioner

- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is unavailable **and** Tencent ASR transcription is enabled for the application
- **THEN** the `Transcribe` menu item is enabled
- **AND** selecting it opens **`TranscribeDialog`** when the target track has a resolvable **`path`**, consistent with music panel transcribe entry points
