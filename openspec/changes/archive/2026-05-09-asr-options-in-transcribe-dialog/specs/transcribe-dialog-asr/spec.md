## ADDED Requirements

### Requirement: Transcribe dialog ASR selection

The system SHALL display an ASR engine selector in **TranscribeDialog** implemented with Shadcn UI **Select** (Radix).

#### Scenario: Available engines

- **WHEN** **TranscribeDialog** is open
- **THEN** the user SHALL be able to choose exactly one of **`bijian`**, **`jianying`**, and **`whisper-cpp`**
- **AND** **`whisper-api`** SHALL NOT be offered

#### Scenario: Default engine

- **WHEN** **TranscribeDialog** opens
- **THEN** the selected ASR SHALL default to **`bijian`**

### Requirement: Selected ASR used for transcribe jobs from dialog

The system SHALL pass the ASR value chosen in **TranscribeDialog** through to VideoCaptioner transcription for every file confirmed in that dialog session.

#### Scenario: Confirm applies chosen engine

- **WHEN** the user selects an ASR engine and confirms **TranscribeDialog** with one or more rows
- **THEN** each resulting transcribe invocation for that confirmation SHALL run **`videocaptioner transcribe`** with **`--asr`** set to the chosen engine
