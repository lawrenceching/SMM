## Context

The current implementation creates recognition plans without UUIDs in the `id` field, even though the `RecognizeMediaFilePlan` type includes an `id: string` field. Additionally, users can only confirm plans but cannot reject them, which creates a poor user experience when plans are incorrect or unwanted.

## Goals / Non-Goals

**Goals:**
- Enable users to reject recognition plans via UI
- Ensure all plans have unique UUIDs for identification
- Maintain consistency with existing API design patterns
- Follow existing code structure and conventions

**Non-Goals:**
- Changing the plan file storage format (stays as JSON files)
- Adding plan history or audit logging (future enhancement)
- Supporting partial plan rejection (all-or-nothing approach)
- Adding notification system for rejected plans

## Decisions

**Decision: Use UUID for plan identification**
- **Rationale**: The `RecognizeMediaFilePlan` type already includes an `id: string` field, and UUIDs provide globally unique identifiers that are suitable for distributed systems
- **Alternatives considered**:
  - Use taskId as the ID: Rejected because taskId is already used for file naming, and separating concerns is better
  - Use sequential IDs: Rejected because UUIDs are more robust and don't require coordination

**Decision: Update plan status to "rejected" instead of deleting**
- **Rationale**: The `RecognizeMediaFilePlan` type already includes `status: "rejected"` as a valid status. Keeping rejected plans allows for potential future features like plan history or analytics
- **Alternatives considered**:
  - Delete plan file: Rejected because it loses information and makes debugging harder
  - Move to archive directory: Rejected as unnecessary complexity for current requirements

**Decision: Reject API follows existing API design pattern**
- **Rationale**: Consistency with existing endpoints like `GetPendingPlans` makes the codebase easier to understand and maintain
- **Implementation**: POST endpoint with request body containing plan ID, returns `{ data, error }` response format

**Decision: Frontend calls reject API directly on cancel**
- **Rationale**: Simple and direct approach that matches the existing confirm flow
- **Alternatives considered**:
  - Use Socket.IO event: Rejected as unnecessary complexity for a simple operation
  - Queue rejection for later: Rejected as it adds complexity without clear benefit

## Risks / Trade-offs

**Risk: Plans without UUIDs created before this change**
- **Mitigation**: The `getAllPendingTasks` function already filters by status, so old plans without UUIDs will still work. New plans will have UUIDs. We can add migration logic later if needed.

**Risk: Race condition if user confirms and cancels simultaneously**
- **Mitigation**: The UI should disable buttons appropriately, and the backend validates plan status before updating. Worst case, the last operation wins, which is acceptable behavior.

**Trade-off: Rejected plans remain in filesystem**
- **Benefit**: Preserves information for debugging and potential future features
- **Cost**: Slight storage overhead (minimal for JSON files)
- **Decision**: Accept the trade-off as the benefits outweigh the minimal cost

## Migration Plan

**No migration needed:**
- Existing plans without UUIDs will continue to work
- New plans will automatically include UUIDs
- Rejected plans will have status updated in-place
- `getAllPendingTasks` already filters by status, so rejected plans won't appear in pending list

**Future considerations:**
- Could add cleanup job to remove old rejected plans after a retention period
- Could add migration script to add UUIDs to existing plans if needed

## Open Questions

None - the implementation is straightforward and follows existing patterns.
