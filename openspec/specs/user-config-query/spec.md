# user-config-query

Persisted user settings (`UserConfig` / `smm.json`) managed in the UI with TanStack Query.

## Requirements

### Requirement: Single query cache for persisted user settings

The UI SHALL maintain persisted user settings (`UserConfig` / `smm.json`) in TanStack Query as the authoritative client-side copy after `userDataDir` is known, using a query key that includes `userDataDir`.

#### Scenario: Load after bootstrap

- **WHEN** `hello()` has provided `userDataDir` and the user-config query runs
- **THEN** the query function SHALL read `smm.json` from that directory and expose the result as query data

#### Scenario: No duplicate context state

- **WHEN** components read `UserConfig` for display or logic
- **THEN** they SHALL consume the TanStack Query-backed value (including via `useConfig` or `useUserConfig`) and SHALL NOT rely on a separate `useState` copy of the full `UserConfig` in `ConfigProvider`

### Requirement: Persisted writes update the cache

The UI SHALL persist changes to `smm.json` through mutation-style flows that complete the write then update the query cache or invalidate as appropriate.

#### Scenario: Full save

- **WHEN** the user saves settings that replace persisted configuration
- **THEN** the UI SHALL write `smm.json` and SHALL reflect the saved `UserConfig` in the query cache after success

#### Scenario: Add media folder

- **WHEN** a new media folder is appended to `UserConfig`
- **THEN** the UI SHALL persist the updated folder list and SHALL update the query cache to match the saved state

### Requirement: External config changes trigger refresh

The UI SHALL refresh query data when notified that persisted user configuration may have changed from outside the current save flow.

#### Scenario: User config updated event

- **WHEN** the application receives a `userConfigUpdated` (or equivalent) signal
- **THEN** the UI SHALL invalidate or refetch the user-config query so subsequent reads match disk

### Requirement: Bootstrap uses the same data path

The UI SHALL populate initial `UserConfig` through the same query mechanism used during normal operation, so startup and later reads do not diverge.

#### Scenario: App initialization

- **WHEN** the app runs its initial bootstrap (`reload` after `hello()`)
- **THEN** the populated `UserConfig` SHALL be stored in the user-config query cache before dependent initialization (e.g. media metadata) runs

### Requirement: Application language tracks persisted language

The UI SHALL align i18n with persisted `applicationLanguage` when that value is loaded or updated from the query.

#### Scenario: Language changes on save

- **WHEN** a save changes `applicationLanguage` relative to the previously persisted value
- **THEN** the UI SHALL apply the new language for the app locale
