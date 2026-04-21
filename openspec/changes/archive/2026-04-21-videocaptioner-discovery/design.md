## Context

The project already has VideoCaptioner discovery and transcription wiring, but discovery only checks configured path, bundled binaries, project bin, and install data directory. In real-world use, VideoCaptioner is often installed by `pip` into Python `Scripts` folders, especially on Windows (for example `AppData/Local/Programs/Python/Python310/Scripts/videocaptioner.exe`), and these paths are currently missed.

The UI currently gates `Transcribe` behavior from discovery, but settings do not expose the resolved executable path, making diagnosis difficult when users report unavailable tools. The change spans backend discovery logic and frontend settings presentation.

## Goals / Non-Goals

**Goals:**
- Discover VideoCaptioner from common Python `Scripts` installation locations (pip-installed layout), with Windows as first-class support.
- Keep discovery presence-based (no command execution validation) to preserve startup speed and deterministic gating.
- Display discovered VideoCaptioner path in `GeneralSettings` so users can verify what executable is used.
- Preserve existing transcription API behavior and menu gating logic.

**Non-Goals:**
- Adding full Python environment introspection (virtualenv/conda exhaustive scanning).
- Running `videocaptioner --help` or version checks during discovery.
- Changing transcription command arguments or adding user-configurable transcription options.

## Decisions

- **Decision: Extend current discovery strategy with Python `Scripts` candidates before returning not found.**  
  Rationale: This keeps compatibility with existing discovery sources while covering the most common pip install path pattern.  
  Alternative considered: replacing existing strategy with Python-only discovery. Rejected because it could regress bundled/manual installations.

- **Decision: Derive Python `Scripts` candidates from OS conventions and user home/env paths.**  
  Rationale: Candidate-based probing (existence checks) is simple, fast, and robust without shelling out to Python.  
  Alternative considered: invoking `python -m site` or `pip show`. Rejected for reliability and startup overhead concerns.

- **Decision: Reuse existing discover endpoint contract (`path` or `error`) and consume it in `GeneralSettings`.**  
  Rationale: Avoids API churn and keeps frontend integration minimal.  
  Alternative considered: introducing a new settings-only endpoint. Rejected as unnecessary duplication.

- **Decision: Surface discovered path as read-only informational setting item.**  
  Rationale: Users need visibility for troubleshooting while keeping scope focused on discovery/display.  
  Alternative considered: editable path field in this change. Deferred to a separate configuration enhancement.

## Risks / Trade-offs

- **[Path false negatives]** Some custom Python installs may use uncommon directory structures -> **Mitigation:** retain existing discovery paths and include configurable executable path as fallback.
- **[OS-specific assumptions]** Candidate generation can be wrong on edge environments -> **Mitigation:** implement conservative, additive path checks and avoid removing existing logic.
- **[UI staleness]** Displayed path may not update if tool availability changes after startup -> **Mitigation:** document current behavior and refresh path when settings view initializes.

## Migration Plan

1. Add Python `Scripts` path candidate generation to VideoCaptioner discovery utility and integrate with existing checks.
2. Ensure discover route returns updated results without contract changes.
3. Add a read-only VideoCaptioner path item in `GeneralSettings` using existing discover API call path.
4. Add/update tests for new discovery branches and settings display behavior.
5. Validate on Windows path pattern and ensure no regression in existing discovery behavior.

Rollback: remove new Python candidate probing and settings display item; existing discovery flow remains unchanged.

## Open Questions

- Should we include user-level roaming Python installs in v1 (`AppData/Roaming/Python/.../Scripts`) or keep to `Local/Programs/Python` first?
- Should the settings item show only resolved path, or also a “Not found” state message with guidance?
