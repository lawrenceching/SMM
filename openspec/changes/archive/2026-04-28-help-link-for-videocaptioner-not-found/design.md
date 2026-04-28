## Context

The status bar already supports typed messages with optional links through `MessageIndicator`. For the VideoCaptioner unavailable state, the UI currently emits an error message without a help link, which forces users to search externally for setup instructions.

## Goals / Non-Goals

**Goals:**
- Add a direct documentation URL to the existing VideoCaptioner not-found status message.
- Preserve existing status bar message rendering and badge behavior.
- Keep the change localized to message composition for the VideoCaptioner unavailable state.

**Non-Goals:**
- Redesign status bar UI layout or interaction patterns.
- Introduce new backend endpoints, dependency checks, or installation automation.
- Modify non-VideoCaptioner status messages.

## Decisions

- Reuse the existing optional `link` field in the status message model instead of adding new message fields.
  - Rationale: The capability already defines link-aware rendering and this avoids broad type/API changes.
  - Alternative considered: Introduce a dedicated "helpAction" payload for messages. Rejected because this is unnecessary for a single external link and increases UI complexity.
- Set the VideoCaptioner not-found link to `https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C`.
  - Rationale: This points directly to the CLI setup section users need after discovery failure.
  - Alternative considered: Link to repository root. Rejected because it is less actionable and increases user navigation steps.

## Risks / Trade-offs

- [External URL changes in upstream docs] -> Keep link centralized in message creation logic so updates are a one-line change.
- [Long URL display in UI] -> Continue rendering message title as primary text while link remains metadata/click target.
- [Potential mismatch with localization tone] -> Keep existing localized title unchanged and only augment link metadata.
