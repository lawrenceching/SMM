## 1. Specification
- [x] 1.1 Create proposal.md with Why, What Changes, and Impact
- [x] 1.2 Create spec.md with ADDED requirements for electron-startup capability
- [x] 1.3 Validate proposal using `openspec validate specify-electron-startup-process --strict`
- [x] 1.4 Update spec to clarify dev mode behavior (no CLI startup, connect to Vite on 5173)
- [x] 1.5 Create design.md with implementation decisions
- [x] 1.6 Re-validate updated spec

## 2. Implementation - Development Mode Changes
- [ ] 2.1 Update `app.whenReady()` handler for dev mode (keep `startCLI()` unchanged)
  - [ ] Add dev mode check at higher level (in `app.whenReady()`)
  - [ ] Skip `startCLI()` call in development mode
  - [ ] Log message indicating CLI should be started externally
  - [ ] Create window directly in development mode
  - [ ] Keep existing production mode behavior (start CLI then create window)
  - [ ] Ensure `startCLI()` function remains unchanged

- [ ] 2.3 Simplify `createWindow()` URL loading logic
  - [ ] Remove `ELECTRON_RENDERER_URL` environment variable check
  - [ ] Remove redundant if/else branches
  - [ ] Development mode: Always load `http://localhost:5173`
  - [ ] Production mode: Load `http://localhost:{cliPort}` (require cliPort to be set)
  - [ ] Add error handling if cliPort is null in production mode

## 3. Implementation - Code Cleanup
- [ ] 3.1 Remove unused code paths
  - [ ] Remove commented-out `ELECTRON_RENDERER_URL` usage
  - [ ] Clean up any dead code related to dev mode CLI startup

- [ ] 3.2 Update function documentation
  - [ ] Update comments in `app.whenReady()` handler to explain dev mode behavior
  - [ ] Update comments in `createWindow()` to clarify URL loading logic
  - [ ] Note: `startCLI()` function remains unchanged (no documentation updates needed)

## 4. Documentation
- [ ] 4.1 Update electron/README.md
  - [ ] Reference the OpenSpec specification
  - [ ] Ensure README aligns with the specified behavior
  - [ ] Clarify that dev mode does NOT start CLI process

## 5. Testing & Validation
- [ ] 5.1 Test development mode startup process
  - [ ] Verify CLI process is NOT started
  - [ ] Verify window loads from `http://localhost:5173`
  - [ ] Verify behavior when Vite dev server is running
  - [ ] Verify behavior when Vite dev server is NOT running (error handling)

- [ ] 5.2 Test production mode startup process
  - [ ] Verify CLI process IS started
  - [ ] Verify port allocation works
  - [ ] Verify window loads from allocated CLI port
  - [ ] Verify CLI process cleanup on app quit

- [ ] 5.3 Verify implementation matches specification
  - [ ] Review electron/src/main/index.ts against spec requirements
  - [ ] Ensure all scenarios are covered
  - [ ] Run openspec validate to ensure spec compliance
