# Design: Electron Startup Process Alignment

## Context

The current implementation and specification have misalignments regarding development mode behavior. The README indicates that in development mode, CLI and UI should be started separately (via `bun run dev`), and Electron should connect to the Vite dev server on port 5173. However, the current implementation always starts its own CLI process, and the spec was written to match this behavior.

## Goals

- Align implementation with the intended development workflow (connect to external services)
- Maintain production mode behavior (self-contained, starts bundled CLI)
- Simplify URL loading logic
- Remove unused code paths

## Decisions

### Decision: Development Mode Behavior
**What**: In development mode, Electron should NOT start its own CLI process. Instead, it should connect to externally running services.

**Why**: 
- The README clearly states that CLI and UI should be started separately in dev mode
- This allows developers to use Vite's HMR and see CLI logs directly
- Reduces resource usage (no duplicate CLI processes)
- Matches typical Electron + Vite development workflow

**Alternatives considered**:
- Keep current behavior (always start CLI): Rejected because it conflicts with README and typical dev workflow
- Make it configurable: Rejected as unnecessary complexity

### Decision: URL Loading Logic
**What**: Simplify URL loading to:
- Development mode: Always load `http://localhost:5173` (Vite dev server)
- Production mode: Load `http://localhost:{cliPort}` (bundled CLI server)

**Why**:
- Removes redundant if/else branches
- Removes unused `ELECTRON_RENDERER_URL` check
- Makes behavior explicit and predictable

**Alternatives considered**:
- Keep fallback logic: Rejected as it adds complexity without clear benefit
- Use environment variable: Rejected as it's not documented and adds indirection

### Decision: CLI Process Startup
**What**: Start CLI and UI dev processes in development mode, bundled CLI in production mode.

**Why**:
- Development mode: Electron spawns `bun run dev` for both CLI and UI modules
- This provides a consistent development experience where Electron manages all processes
- Production mode: Uses bundled CLI executable for self-contained deployment
- Allows developers to see all logs in one place (Electron console)

## Implementation Plan

### Changes to `electron/src/main/index.ts`

1. **Add dev process management functions**:
   - `startCLIDev()`: Spawn `bun run dev` in CLI directory
   - `startUIDev()`: Spawn `bun run dev` in UI directory
   - `stopDevProcesses()`: Clean up both dev processes
   - Track processes with `cliDevProcess` and `uiDevProcess` variables

2. **Modify `app.whenReady()` handler**:
   - Development mode: Call `startCLIDev()` and `startUIDev()`, then create window after short delay
   - Production mode: Call `startCLI()` then create window (existing behavior)
   - Keep `startCLI()` function unchanged

2. **Simplify `createWindow()` URL loading**:
   - Remove `ELECTRON_RENDERER_URL` check
   - Remove redundant if/else branches
   - Development mode: Always load `http://localhost:5173`
   - Production mode: Load `http://localhost:{cliPort}` (require cliPort to be set)

3. **Implementation approach**:
   - Dev mode checking happens at `app.whenReady()` level
   - Separate functions for dev processes (`startCLIDev()`, `startUIDev()`) vs production CLI (`startCLI()`)
   - Clear separation: dev mode uses `bun run dev`, production uses bundled executable
   - All processes tracked for proper cleanup on app quit

### Changes to Specification

Update `specs/electron-startup/spec.md` to reflect:
- Development mode does NOT start CLI process
- Development mode loads from Vite dev server (port 5173)
- Production mode starts bundled CLI and loads from CLI port

## Risks / Trade-offs

- **Risk**: Dev processes might not be ready when window loads
  - **Mitigation**: Added 1 second delay before creating window to allow processes to start
  - **Future**: Could add health checks or wait for specific log messages

- **Risk**: Port 5173 might be in use by another service
  - **Mitigation**: Vite will automatically find another port and display it, but Electron won't know. Consider adding port detection or configuration.

- **Risk**: Bun might not be in PATH
  - **Mitigation**: Using `shell: true` in spawn options to use system shell
  - **Future**: Could add explicit bun path detection

- **Trade-off**: Electron manages all processes in dev mode
  - **Benefit**: Single point of control, all logs in one place
  - **Benefit**: Easier for developers (just run Electron)

## Migration Plan

1. Update specification to match intended behavior
2. Update implementation to match specification
3. Update README to ensure consistency
4. Test both dev and production modes
5. Validate against specification

## Open Questions

- Should we add port detection for Vite dev server in dev mode? (Currently assumes 5173)
- Should we add a check to verify Vite dev server is running before loading window?
