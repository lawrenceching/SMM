# Change: Add Clean Up Feature

## Why

Developers need a way to clean up user configuration and media metadata cache during development and troubleshooting. This feature allows developers to reset the application state by removing cached data and configuration files, which is useful for testing, debugging, and resolving configuration issues.

## What Changes

- Add "Clean Up" menu item in the UI menu component (`ui/src/components/menu.tsx`)
- Add `clean-up` debug API function in the CLI module (`cli/src/route/Debug.ts`)
- Implement cleanup logic to delete user config file and media metadata cache directory
- Update Debug API documentation (`docs/DebugAPI.md`) with the new function

## Impact

- Affected specs: New `cleanup` capability
- Affected code:
  - `ui/src/components/menu.tsx` - Add menu item
  - `cli/src/route/Debug.ts` - Add clean-up function handler
  - `docs/DebugAPI.md` - Document new debug function
  - `cli/src/utils/config.ts` - Reference for user config path
  - `cli/src/route/mediaMetadata/utils.ts` - Reference for metadata directory path
