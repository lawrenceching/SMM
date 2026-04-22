## 1. Batch Transcribe Trigger

- [x] 1.1 Update `MusicPanel` transcribe action to collect all selected media files in select mode and submit them as one batch.
- [x] 1.2 Add guardrails for empty selection and duplicate trigger clicks during batch submission.

## 2. Background Job Queue Lifecycle

- [x] 2.1 Create one background job per selected file in `pending` state before any transcription request is started.
- [x] 2.2 Implement queue runner logic that promotes exactly one pending job to `running` when no running batch job exists.
- [x] 2.3 On running job completion, set job state to `succeeded` or `failed` and automatically start the next pending job.

## 3. Feedback and Verification

- [x] 3.1 Ensure UI feedback/toast behavior remains consistent for each job while processing sequentially.
- [x] 3.2 Add or update tests to verify pending initialization, single-concurrency execution, ordered progression, and failure-then-continue behavior.
