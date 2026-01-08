# Implementation Plan: Align Electron Startup with Specification

## Summary of Misalignments Found

1. **Development Mode Process Management**: Current code doesn't start CLI/UI dev processes - Electron should spawn `bun run dev` for both modules
2. **URL Loading Logic**: Current code has redundant branches and unused `ELECTRON_RENDERER_URL` check
3. **Port Usage**: Current code uses CLI port in dev mode, but spec requires Vite dev server (port 5173)

## Required Changes

### 1. Update `app.whenReady()` Handler (lines 186-242)

**Current Behavior**: Always calls `startCLI()` then creates window (lines 228-235)

**Required Change**: Add functions to start CLI and UI dev processes, then conditionally call them in dev mode.

**New Functions to Add**:
```typescript
// Add process tracking variables at top
let cliDevProcess: ChildProcess | null = null
let uiDevProcess: ChildProcess | null = null

// Add function to start CLI dev process
function startCLIDev(): void {
  // Spawn 'bun run dev' in CLI directory
  // Capture stdout/stderr with [cli-dev] prefix
  // Track process for cleanup
}

// Add function to start UI dev process  
function startUIDev(): void {
  // Spawn 'bun run dev' in UI directory
  // Capture stdout/stderr with [ui-dev] prefix
  // Track process for cleanup
}

// Add function to stop dev processes
function stopDevProcesses(): void {
  // Kill both CLI and UI dev processes
}
```

**Update `app.whenReady()` handler**:
```typescript
app.whenReady().then(() => {
  // ... existing setup code (lines 186-227) ...
  
  // Replace this section (lines 228-235):
  if (is.dev) {
    // Development mode: Start CLI and UI dev processes
    console.log('Development mode: Starting CLI and UI dev processes')
    startCLIDev()
    startUIDev()
    // Give dev processes a moment to start, then create window
    setTimeout(() => {
      createWindow()
    }, 1000)
  } else {
    // Production mode: Start CLI then create window
    startCLI().then(() => {
      createWindow()
    }).catch((error) => {
      console.error('Failed to start CLI:', error)
      createWindow()
    })
  }
  
  // ... rest of existing code ...
})
```

**Update cleanup handler**:
```typescript
app.on('before-quit', () => {
  if (is.dev) {
    stopDevProcesses()
  } else {
    stopCLI()
  }
})
```

**Note**: The `startCLI()` function remains unchanged. Dev mode uses separate functions.

### 2. Simplify `createWindow()` URL Loading (lines 148-181)

**Current Behavior**: 
- Checks `is.dev && process.env['ELECTRON_RENDERER_URL']` but doesn't use it
- Both branches load the same URL
- Uses fallback port 5173

**Required Change**: Simplify to explicit mode-based loading

```typescript
function createWindow(): void {
  // ... existing window creation code ...
  
  // Replace lines 171-180 with:
  if (is.dev) {
    // Development mode: Connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // Production mode: Connect to bundled CLI server
    if (cliPort === null) {
      console.error('Production mode: CLI port not allocated. Window may not load correctly.')
    }
    mainWindow.loadURL(`http://localhost:${cliPort || 5173}`)
  }
}
```

### 3. Code Cleanup

**Remove**:
- Line 174: Unused `ELECTRON_RENDERER_URL` check
- Line 175: Commented-out code
- Redundant if/else logic

**Update Comments**:
- Update line 171 comment to reflect new behavior
- Update comments in `app.whenReady()` to explain dev mode behavior

## Testing Checklist

### Development Mode
- [ ] Start Electron: `cd electron && bun run dev`
- [ ] Verify: Electron starts CLI dev process (`bun run dev` in cli folder)
- [ ] Verify: Electron starts UI dev process (`bun run dev` in ui folder)
- [ ] Verify: Console shows `[cli-dev]` and `[ui-dev]` prefixed logs
- [ ] Verify: Electron window loads from `http://localhost:5173`
- [ ] Verify: Both dev processes are tracked and cleaned up on app quit

### Production Mode
- [ ] Build Electron app
- [ ] Start Electron app
- [ ] Verify: CLI process is started automatically
- [ ] Verify: Port is allocated (check console logs)
- [ ] Verify: Window loads from allocated CLI port
- [ ] Verify: CLI process cleanup on app quit

## Files to Modify

1. `electron/src/main/index.ts`
   - Modify `app.whenReady()` handler (add dev mode check at higher level)
   - Modify `createWindow()` function (simplify URL loading)
   - Keep `startCLI()` function unchanged
   - Update comments

2. `electron/README.md` (optional)
   - Update to reference OpenSpec specification
   - Clarify dev mode behavior

## Risk Mitigation

- **Risk**: Developers forget to start CLI/UI in dev mode
  - **Mitigation**: Clear console message when skipping CLI startup
  - **Mitigation**: README documentation

- **Risk**: Port 5173 in use by another service
  - **Mitigation**: Vite will auto-select another port, but Electron won't know
  - **Future**: Consider adding port detection or configuration
