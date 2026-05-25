## ADDED Requirements

### Requirement: Cookie cache stores entries keyed by domain

The system SHALL maintain an in-memory cache of cookie configurations keyed by URL hostname. Each entry SHALL store the cookie text, use-cookies flag, use-cookies-from-browser flag, and selected browser id.

The cache SHALL NOT persist to disk or localStorage. It SHALL be cleared on page refresh.

#### Scenario: Cache entry stored on Go

- **WHEN** the user clicks "Go" with non-empty cookie text configured for `www.youtube.com`
- **THEN** the cache SHALL store the cookie text, flags, and browser id under key `www.youtube.com`

#### Scenario: Cache entry stored on Start

- **WHEN** the user clicks "Start" with non-empty cookie text for `www.bilibili.com`
- **THEN** the cache SHALL store the entry under key `www.bilibili.com`

#### Scenario: Cache not stored for empty cookies

- **WHEN** the user clicks "Go" or "Start" with no cookies configured
- **THEN** the cache SHALL NOT store an entry for that domain

### Requirement: Cookie cache pre-fills on URL change

When the user enters or changes the URL, the system SHALL look up the cache by the new URL's hostname. If a matching entry exists, the system SHALL pre-fill the cookie text, checkboxes, and browser selection from the cache.

#### Scenario: Cache hit pre-fills cookies

- **WHEN** the user enters a URL with hostname `www.youtube.com`
- **AND** a cached entry exists for `www.youtube.com`
- **THEN** the cookie text SHALL be pre-filled from the cache
- **AND** the "Use cookies" checkbox SHALL be set to the cached value
- **AND** the "From browser" checkbox SHALL be set to the cached value
- **AND** the browser selector SHALL be set to the cached value

#### Scenario: Cache miss does nothing

- **WHEN** the user enters a URL with hostname `www.example.com`
- **AND** no cached entry exists for `www.example.com`
- **THEN** the cookie fields SHALL remain unchanged

#### Scenario: Empty URL does not trigger lookup

- **WHEN** the user clears the URL field
- **THEN** the system SHALL NOT attempt a cache lookup
