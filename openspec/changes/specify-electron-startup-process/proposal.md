# Change: Specify Electron Wrapper Startup Process

## Why

The current Electron wrapper startup process is partially documented in the README but lacks a formal specification. The code already uses `is.dev` from `@electron-toolkit/utils` to differentiate between development and production modes, but the startup flow needs to be clearly specified to ensure consistent behavior and proper documentation for developers.

## What Changes

- Document the complete startup process for development mode
- Document the complete startup process for production mode
- Specify how `is.dev` is used to determine the execution mode
- Define the CLI executable path resolution for both modes
- Define the public folder path resolution for both modes
- Specify the port allocation and URL loading behavior
- Document the CLI process lifecycle management

## Impact

- **Affected specs**: New capability `electron-startup`
- **Affected code**:
  - `electron/src/main/index.ts` - Already implements the logic, will be validated against spec
  - `electron/README.md` - Will be updated to reference the spec
- **Developer experience**: Clear specification of startup behavior for both modes
- **Non-breaking**: This is a documentation/specification change that formalizes existing behavior
