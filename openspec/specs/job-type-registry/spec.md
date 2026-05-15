# job-type-registry

Declarative registry mapping job type strings to metadata used by the job orchestrator (SW events, auto-start preferences, path extraction, toasts).

## Requirements

### Requirement: Registry defines per-type metadata
The system SHALL maintain a `JOB_TYPE_REGISTRY` module (`src/lib/jobTypeRegistry.ts`) that maps every registered job type string to a `JobTypeConfig` object. The registry SHALL be a plain data module with no runtime side effects — it MUST NOT import any job factory, React component, or Service Worker code.

Each `JobTypeConfig` SHALL define:
- `messagePrefix: string` — prefix used to derive SW message event names (`${prefix}:start`, `${prefix}:stop`, `${prefix}:remove`, `${prefix}:started`, `${prefix}:succeeded`, `${prefix}:failed`, `${prefix}:stopped`, `${prefix}:removed`, `${prefix}:heartbeat`)
- `autoStartKey: string` — `localStorage` key storing the user's auto-start preference for this type (value `'false'` disables auto-start; any other value or absence enables it)
- `extractPath: (data: unknown) => string` — pure function that extracts a stable file/entity path from the job's data payload; returns `''` when no path association is needed
- `toasts?: { started?, succeeded?, failed? }` — optional lifecycle toast message factories (functions receiving a `TFunction` and returning a string)

#### Scenario: Derive SW event names from prefix
- **WHEN** `swEventNames(prefix)` is called with a type's `messagePrefix`
- **THEN** it returns an object with keys `start`, `stop`, `remove`, `started`, `succeeded`, `failed`, `stopped`, `removed`, `heartbeat`, each valued as `${prefix}:<key>`

#### Scenario: All current job types registered
- **WHEN** the registry module is imported
- **THEN** it SHALL contain entries for `'download-video'`, `'transcribe'`, `'translate'`, `'synthesize'`, and `'process'` at minimum

#### Scenario: Lookup by type key
- **WHEN** `JOB_TYPE_REGISTRY['transcribe']` is accessed
- **THEN** it returns the `JobTypeConfig` for the transcribe job type, including a non-empty `messagePrefix` and a valid `extractPath` function

---

### Requirement: Registry is the single extension point for new job types
Adding a new job type SHALL require exactly one change to the registry: a new key-value entry in `JOB_TYPE_REGISTRY`. The orchestrator, Zustand store, and IndexedDB layer SHALL require zero changes.

#### Scenario: New type is handled generically by orchestrator
- **WHEN** a new job type entry is added to `JOB_TYPE_REGISTRY`
- **THEN** the orchestrator automatically handles SW message routing, auto-start scheduling, and `useFileStatuses` path extraction for that type without any code change to the orchestrator

#### Scenario: Registry entry drives auto-start preference
- **WHEN** `localStorage.getItem(config.autoStartKey)` returns `'false'` for a type
- **THEN** the orchestrator SHALL NOT auto-start pending jobs of that type until the preference changes

---

### Requirement: `extractPath` enables file-level status queries
The `extractPath` function SHALL return a stable, non-empty string path for job types that associate with a media file path. It SHALL return `''` for job types that have no file path association.

#### Scenario: Path extraction for transcribe job
- **WHEN** `extractPath` is called on a transcribe job's data payload containing `{ mediaPath: '/music/song.mp3' }`
- **THEN** it returns `'/music/song.mp3'`

#### Scenario: Path extraction returns empty for no association
- **WHEN** `extractPath` is called on a job type that has no path association (or data is malformed)
- **THEN** it returns `''` and the job is excluded from `useFileStatuses` path-indexed results
