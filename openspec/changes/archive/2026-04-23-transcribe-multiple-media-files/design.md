## Context

`MusicPanel` already supports explicit multi-select mode and single-file transcription feedback, but it does not define how batch transcription should be orchestrated when multiple files are selected. The new requirement is to enqueue all selected files as background jobs in `pending`, then process exactly one job at a time in selection order, starting the next job only after the previous one completes (success or failure).

## Goals / Non-Goals

**Goals:**
- Support one-click batch transcription from `MusicPanel` when multiple files are selected.
- Create visible background job records for all selected files immediately.
- Guarantee sequential execution with no parallel transcription requests from this flow.
- Continue queue progression after failures so one failed file does not block remaining files.

**Non-Goals:**
- Building a cross-panel global scheduler for unrelated job types.
- Adding pause/resume/reorder/cancel controls for queued transcription jobs.
- Changing backend transcription semantics beyond existing per-file invocation contract.

## Decisions

- Use a UI-managed FIFO queue model scoped to the `MusicPanel` transcription flow.
  - Rationale: Existing behavior is initiated from UI interactions and already updates local background job state. A FIFO queue preserves user expectation from selected order and minimizes architecture changes.
  - Alternative considered: Fire all requests concurrently and rely on backend ordering. Rejected because it violates the explicit sequential requirement and complicates per-job lifecycle visibility.

- Insert all selected files as `pending` jobs before starting execution.
  - Rationale: This gives immediate feedback that the batch was accepted and clarifies upcoming workload.
  - Alternative considered: Create jobs lazily when each item starts. Rejected because pending jobs would be invisible, conflicting with the requirement that all tasks remain pending until started.

- Advance queue on terminal state (`succeeded` or `failed`) of the running job.
  - Rationale: Prevents deadlock when one file fails and aligns with requirement to continue regardless of outcome.
  - Alternative considered: Stop on first failure. Rejected because it reduces throughput and does not match requested behavior.

- Keep execution lock at one active running transcription job for this queue.
  - Rationale: Enforces strict single concurrency and makes status transitions deterministic and testable.
  - Alternative considered: Limited parallelism (e.g., 2 at once). Rejected because requirement explicitly forbids simultaneous execution.

## Risks / Trade-offs

- [Risk] Queue state desynchronization if component unmounts mid-batch. -> Mitigation: Store queue progression in the same background job state source that survives transient re-renders, and derive next runnable job from canonical job state.
- [Risk] Rapid repeated clicks may enqueue duplicate batches unexpectedly. -> Mitigation: Guard the transcribe action while submission is in progress or deduplicate identical pending entries by file identity within the same trigger event.
- [Trade-off] Sequential execution increases total completion time versus parallel submission. -> Mitigation: Favor predictable resource use and explicit user-visible ordering over maximum throughput.
