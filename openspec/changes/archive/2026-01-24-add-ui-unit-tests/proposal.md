# Change: Add Unit Testing Infrastructure to UI Module

## Why

The UI module currently lacks unit testing infrastructure. To ensure code quality, catch regressions early, and maintain confidence in refactoring, we need to establish a comprehensive unit testing setup using vitest and react-dom. This will enable testing of utility functions, components, and business logic within the UI module.

## What Changes

- Add `vitest` and `@testing-library/react` to UI module dependencies
- Add `@testing-library/react-dom` and `@testing-library/jest-dom` for React component testing
- Configure vitest with proper TypeScript and React support
- Set up test scripts in `package.json`
- Create initial test file for `_buildMappingFromSeasonModels` function in `TvShowPanelUtils.ts`
- Establish testing conventions and file structure
- Configure vitest to work with React 19 and Vite

## Impact

- **Affected specs**: New capability `ui-testing`
- **Affected code**:
  - `ui/package.json` - Add testing dependencies and scripts
  - `ui/vitest.config.ts` - New vitest configuration file
  - `ui/src/components/TvShowPanelUtils.test.ts` - First unit test file
  - `ui/tsconfig.json` - May need updates for test file paths
- **Developer experience**: Developers can now write and run unit tests for UI components and utilities
- **Non-breaking**: This is a pure addition that doesn't affect existing functionality
