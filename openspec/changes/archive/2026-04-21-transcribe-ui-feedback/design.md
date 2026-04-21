## Context

Current transcribe flow triggers VideoCaptioner as a detached background process and immediately returns success when process start succeeds. This gives fast API responses but prevents UI from knowing final outcome. As a result, users only see a “started” signal and cannot distinguish completion success vs runtime failure.

The requested behavior adds two UX layers in `MusicPanel`: immediate start feedback + background job creation, and final completion feedback + job status update based on API completion result. This requires a semantic change in backend API timing (wait for command completion).

## Goals / Non-Goals

**Goals:**
- Make `/api/videocaptioner/transcribe` wait for command completion and return final success/failure.
- Show `Transcribe start` toast immediately on click and create a background job entry.
- Update background job to succeeded/failed according to API result.
- Show completion toast (success or failure) after API returns.

**Non-Goals:**
- Streaming partial transcription progress from VideoCaptioner.
- Introducing multi-stage job orchestration service or queue worker.
- Redesigning the whole background job architecture beyond transcribe integration.

## Decisions

- **Decision: Replace detached spawn with awaitable child-process completion in transcribe path.**  
  Rationale: UI needs deterministic final outcome from API response to update toast and job status.  
  Alternative considered: keep detached process and poll output files. Rejected due to extra complexity and weaker reliability for immediate UX.

- **Decision: Keep API contract simple (`success`/`error`) but change semantics to “completed result”.**  
  Rationale: Minimizes frontend API surface changes while providing required behavior shift.  
  Alternative considered: new endpoint for synchronous mode. Rejected as unnecessary duplication.

- **Decision: Model transcribe as a background job lifecycle in `backgroundJobsStore` with explicit status transitions.**  
  Rationale: Reuses existing UI pattern and keeps user feedback consistent with other long-running tasks.  
  Alternative considered: toast-only without jobs. Rejected because requirement explicitly asks to add/update background job.

- **Decision: Emit “start” toast before awaiting API, then completion toast after result.**  
  Rationale: Gives immediate response to click while preserving final truth signal.  
  Alternative considered: only completion toast. Rejected because user requested start toast.

## Risks / Trade-offs

- **[Long request duration]** Synchronous API may block longer and feel slower -> **Mitigation:** use clear start toast + running job state to communicate ongoing work.
- **[Timeout/failure ambiguity]** Child process may hang or take too long -> **Mitigation:** add timeout/error mapping and convert to stable API error for UI.
- **[Store coupling]** Job lifecycle changes may accidentally impact existing download job logic -> **Mitigation:** isolate transcribe-specific job type/metadata and add targeted tests.

## Migration Plan

1. Refactor backend transcribe utility to wait for process exit and return final result.
2. Update transcribe route behavior/tests for synchronous completion semantics.
3. Add transcribe job creation/update helpers in `backgroundJobsStore`.
4. Update `MusicPanel` flow: start toast + create job -> call API -> completion toast + mark job result.
5. Add/update tests for backend completion semantics and UI/store transitions.
6. Validate no regressions in existing transcribe menu gating and other background jobs.

Rollback: restore detached execution + immediate return and remove transcribe-specific background job state transitions.

## Open Questions

- What timeout threshold should be used before treating transcribe as failed in API?
- Should transcribe jobs remain in UI history after completion, or auto-clear after a delay?
