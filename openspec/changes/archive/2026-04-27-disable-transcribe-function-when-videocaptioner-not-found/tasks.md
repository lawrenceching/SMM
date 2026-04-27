## 1. Wire VideoCaptioner availability into UI behavior

- [x] 1.1 Review how VideoCaptioner discovery availability is exposed to UI state used by `StatusBar` and `MusicFileTable`.
- [x] 1.2 Ensure `StatusBar` computes a `videocaptioner not found` `error` message when discovery reports unavailable.

## 2. Gate Transcribe action in MusicFileTable

- [x] 2.1 Update `MusicFileTable` context-menu item state so `Transcribe` is disabled when VideoCaptioner is unavailable.
- [x] 2.2 Verify disabled `Transcribe` cannot trigger transcribe queue creation or background-job start.

## 3. Validate UX behavior and regressions

- [x] 3.1 Manually verify status bar message and transcribe menu state for both available and unavailable discovery states.
- [x] 3.2 Confirm existing transcribe workflow remains unchanged when VideoCaptioner is available.
