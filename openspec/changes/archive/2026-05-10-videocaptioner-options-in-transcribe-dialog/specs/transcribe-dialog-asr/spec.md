## MODIFIED Requirements

### Requirement: Transcribe dialog ASR selection

The system SHALL display a **Provider** selector in **TranscribeDialog** with exactly **`VideoCaptioner`** and **`Tencent ASR`**, implemented with Shadcn UI **Select** (Radix). When **VideoCaptioner** is selected, the system SHALL display an ASR engine selector with exactly **`bijian`**, **`jianying`**, and **`whisper-cpp`** offered and **`whisper-api`** NOT offered. When **Tencent ASR** is selected, the system SHALL NOT display the ASR selector and SHALL display **Base URL** and **API Key** inputs instead.

#### Scenario: Default provider

- **WHEN** **TranscribeDialog** opens
- **THEN** the selected provider defaults to **`VideoCaptioner`**

#### Scenario: VideoCaptioner shows ASR and transcribe options

- **WHEN** **VideoCaptioner** is selected
- **THEN** the user SHALL be able to choose exactly one ASR engine among **`bijian`**, **`jianying`**, and **`whisper-cpp`**
- **AND** the UI SHALL expose **Language** (ISO 639-1 code or **`auto`**), **Word timestamps** (on/off), and **Format** with values **`srt`**, **`ass`**, **`txt`**, and **`json`**, consistent with **`videocaptioner transcribe`** optional flags

#### Scenario: Default VideoCaptioner option values

- **WHEN** **TranscribeDialog** opens with **VideoCaptioner** selected
- **THEN** **Language** defaults to **`auto`**, **Word timestamps** defaults to off, **Format** defaults to **`srt`**, and ASR defaults to **`bijian`**

#### Scenario: Tencent ASR shows endpoint credentials

- **WHEN** **Tencent ASR** is selected
- **THEN** the UI shows **Base URL** and **API Key** fields
- **AND** VideoCaptioner-only controls (ASR, language, word timestamps, format) are not shown

#### Scenario: Tencent confirm requires credentials

- **WHEN** **Tencent ASR** is selected and **Base URL** or **API Key** is empty (after trim)
- **THEN** the user cannot successfully confirm **TranscribeDialog** (confirm disabled or validation prevents enqueue)

### Requirement: Selected ASR used for transcribe jobs from dialog

The system SHALL pass the **Provider** and provider-specific options chosen in **TranscribeDialog** through to the transcription integration for every file confirmed in that dialog session. When **VideoCaptioner** is selected, each invocation SHALL use the chosen ASR and SHALL map **Language**, **Word timestamps**, and **Format** to **`videocaptioner transcribe`** as **`--language`**, **`--word-timestamps`** (when enabled), and **`--format`** respectively. When **Tencent ASR** is selected, each invocation SHALL use the **Tencent ASR transcribe HTTP API** with the entered **Base URL** and **API Key**.

#### Scenario: Confirm applies VideoCaptioner options

- **WHEN** the user confirms **TranscribeDialog** with **VideoCaptioner** selected and one or more rows
- **THEN** each resulting transcribe invocation for that confirmation SHALL run **`videocaptioner transcribe`** with **`--asr`** set to the chosen engine
- **AND** SHALL pass **`--language`** set to the UI-selected language value (**`auto`** or an ISO 639-1 code)
- **AND** SHALL pass **`--word-timestamps`** when **Word timestamps** is enabled
- **AND** SHALL pass **`--format`** matching the selected format

#### Scenario: Confirm applies Tencent credentials

- **WHEN** the user confirms **TranscribeDialog** with **Tencent ASR** selected
- **THEN** each resulting transcribe invocation for that confirmation SHALL call the Tencent ASR transcribe API path with the supplied **Base URL** and **API Key**
