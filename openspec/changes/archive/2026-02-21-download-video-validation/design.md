## Context

The download video dialog (`download-video-dialog.tsx`) currently only checks `url.trim()` is truthy before enabling the download button and calling the backend. The backend route (`Download.ts`) passes the raw request body directly to `downloadYtdlpVideo()` with no validation. There is no shared validation logic — each layer does its own ad-hoc checks (or none).

The `packages/core` workspace (`@smm/core`) already serves as the shared code layer between UI and CLI, exporting utilities like `path.ts`, `types.ts`, and `errors.ts`. It supports direct TypeScript imports from both workspaces via the `"./*": "./*"` export map.

## Goals / Non-Goals

**Goals:**
- Centralize download URL validation in a single shared module reusable by both UI and backend
- Provide clear, specific error messages for each validation failure (empty URL, invalid format, unsupported platform)
- Show inline validation feedback in the UI before the user submits
- Reject invalid URLs at the backend before invoking yt-dlp

**Non-Goals:**
- Validating that the video actually exists at the URL (that's yt-dlp's job)
- Supporting additional platforms beyond YouTube and Bilibili in this change
- Validating the download folder path (existing behavior is sufficient)
- ~~i18n of validation error messages~~ (implemented: error codes are mapped to translated strings in all 4 locales)

## Decisions

### 1. Single validation module in `packages/core`

Create `packages/core/download-video-validators.ts` with pure functions that have no runtime dependencies (no Node.js APIs, no browser APIs beyond `URL` constructor which is available in both environments).

**Rationale**: Keeps validation logic in one place. Both UI and CLI already depend on `@smm/core`. Pure functions are easy to test and have no platform concerns.

### 2. Validation result structure

Return a structured result object rather than throwing errors:

```typescript
type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }
```

The `error` field uses a machine-readable error code string (e.g., `"URL_EMPTY"`, `"URL_INVALID"`, `"URL_PLATFORM_NOT_ALLOWED"`). The UI maps these to i18n-translated messages; the backend returns them as error reasons.

**Rationale**: Structured results are easier to handle in both UI (conditional rendering) and backend (error responses) than try/catch. Error codes decouple validation logic from display concerns.

### 3. Platform allowlist via hostname matching

Use the `URL` constructor to parse the URL, then check the hostname against an allowlist:

- YouTube: hostnames matching `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `music.youtube.com`
- Bilibili: hostnames matching `bilibili.com`, `www.bilibili.com`, `m.bilibili.com`, `b23.tv`

**Rationale**: Hostname matching is simple, robust, and doesn't depend on URL path structure which may change. The `URL` constructor handles normalization. The allowlist is easy to extend later.

### 4. UI validation approach

Call the shared validator on blur and on change (after first interaction). Display the error message below the URL input using the existing form layout. The download button remains disabled when validation fails.

**Rationale**: Validating on blur gives immediate feedback without being intrusive during typing. Re-validating on change after first blur ensures the error clears as soon as the user fixes it.

### 5. Backend validation placement

Validate in `processYtdlpDownload()` before calling `downloadYtdlpVideo()`. Return 400 with the validation error.

**Rationale**: Keeps the route handler clean. Validation errors are client errors (400), distinct from server errors (500).

## Risks / Trade-offs

- **URL constructor availability**: The `URL` constructor is available in all modern browsers and in Bun/Node.js. No polyfill needed. → Low risk.
- **Allowlist maintenance**: New platforms require code changes to the allowlist. → Acceptable for now; a configuration-based approach can be added later if needed.
- **Error code coupling**: UI and backend must agree on error code strings. → Mitigated by both importing from the same module with exported constants.
