### Requirement: URL must not be empty
The validation SHALL reject URLs that are empty or contain only whitespace.

#### Scenario: Empty string URL
- **WHEN** the URL is an empty string `""`
- **THEN** validation SHALL return invalid with error `"URL_EMPTY"`

#### Scenario: Whitespace-only URL
- **WHEN** the URL is `"   "` (whitespace only)
- **THEN** validation SHALL return invalid with error `"URL_EMPTY"`

### Requirement: URL must be a valid URL format
The validation SHALL reject URLs that are not valid URL format. A URL is considered valid if it can be parsed by the `URL` constructor without throwing and uses `http` or `https` protocol.

#### Scenario: Valid URL format
- **WHEN** the URL is `"https://www.youtube.com/watch?v=abc123"`
- **THEN** validation SHALL return valid

#### Scenario: Invalid URL format - no protocol
- **WHEN** the URL is `"not-a-url"`
- **THEN** validation SHALL return invalid with error `"URL_INVALID"`

#### Scenario: Invalid URL format - malformed
- **WHEN** the URL is `"http://"`
- **THEN** validation SHALL return invalid with error `"URL_INVALID"`

#### Scenario: Invalid URL format - non-http protocol
- **WHEN** the URL is `"http1s://www.bilibili.com/video/BV1TyZqBcEJb"`
- **THEN** validation SHALL return invalid with error `"URL_INVALID"`

#### Scenario: Invalid URL format - ftp protocol
- **WHEN** the URL is `"ftp://www.youtube.com/video"`
- **THEN** validation SHALL return invalid with error `"URL_INVALID"`

### Requirement: URL must be from an allowed platform
The validation SHALL reject URLs whose hostname does not match the allowed platform list. Allowed platforms are YouTube and Bilibili.

Allowed YouTube hostnames: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `music.youtube.com`

Allowed Bilibili hostnames: `bilibili.com`, `www.bilibili.com`, `m.bilibili.com`, `b23.tv`

#### Scenario: YouTube URL is allowed
- **WHEN** the URL is `"https://www.youtube.com/watch?v=abc123"`
- **THEN** validation SHALL return valid

#### Scenario: YouTube short URL is allowed
- **WHEN** the URL is `"https://youtu.be/abc123"`
- **THEN** validation SHALL return valid

#### Scenario: YouTube Music URL is allowed
- **WHEN** the URL is `"https://music.youtube.com/watch?v=abc123"`
- **THEN** validation SHALL return valid

#### Scenario: Bilibili URL is allowed
- **WHEN** the URL is `"https://www.bilibili.com/video/BV1xx411c7mD"`
- **THEN** validation SHALL return valid

#### Scenario: Bilibili short URL is allowed
- **WHEN** the URL is `"https://b23.tv/abc123"`
- **THEN** validation SHALL return valid

#### Scenario: Unsupported platform is rejected
- **WHEN** the URL is `"https://vimeo.com/123456"`
- **THEN** validation SHALL return invalid with error `"URL_PLATFORM_NOT_ALLOWED"`

### Requirement: Validation is applied in UI before submission
The UI SHALL validate the URL input and display the corresponding error message to the user. The download button SHALL remain disabled when validation fails.

#### Scenario: UI shows error for empty URL on interaction
- **WHEN** user clears the URL input and moves focus away
- **THEN** the UI SHALL display an error hint for the empty URL

#### Scenario: UI shows error for unsupported platform
- **WHEN** user enters `"https://vimeo.com/123456"` in the URL input
- **THEN** the UI SHALL display an error hint indicating the platform is not supported

#### Scenario: UI clears error when input becomes valid
- **WHEN** user corrects the URL to a valid YouTube URL
- **THEN** the UI SHALL remove the error hint and enable the download button

### Requirement: Validation is applied in backend before download
The backend SHALL validate the URL using the same shared validators before invoking yt-dlp. If validation fails, the backend SHALL return HTTP 400 with the validation error.

#### Scenario: Backend rejects empty URL
- **WHEN** a request is received with an empty URL
- **THEN** the backend SHALL return HTTP 400 with error `"URL_EMPTY"`

#### Scenario: Backend rejects invalid URL format
- **WHEN** a request is received with URL `"not-a-url"`
- **THEN** the backend SHALL return HTTP 400 with error `"URL_INVALID"`

#### Scenario: Backend rejects unsupported platform
- **WHEN** a request is received with URL `"https://vimeo.com/123456"`
- **THEN** the backend SHALL return HTTP 400 with error `"URL_PLATFORM_NOT_ALLOWED"`

#### Scenario: Backend proceeds with valid URL
- **WHEN** a request is received with URL `"https://www.youtube.com/watch?v=abc123"`
- **THEN** the backend SHALL proceed to invoke yt-dlp for download
