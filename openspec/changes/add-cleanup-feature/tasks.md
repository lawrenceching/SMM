## 1. Implementation

- [ ] 1.1 Add "Clean Up" menu item to UI menu component
  - [ ] 1.1.1 Add menu item in `ui/src/components/menu.tsx` with appropriate translation key
  - [ ] 1.1.2 Add translation strings for "Clean Up" in all locale files (`ui/public/locales/*/components.json`)
  - [ ] 1.1.3 Implement onClick handler to call the clean-up debug API

- [ ] 1.2 Implement clean-up debug API function in CLI
  - [ ] 1.2.1 Add `cleanUp` schema to `debugRequestSchema` in `cli/src/route/Debug.ts`
  - [ ] 1.2.2 Implement `cleanUp` case in `processDebugRequest` function
  - [ ] 1.2.3 Add logic to delete user config file using `getUserConfigPath()` from `cli/src/utils/config.ts`
  - [ ] 1.2.4 Add logic to delete media metadata cache directory using `mediaMetadataDir` from `cli/src/route/mediaMetadata/utils.ts`
  - [ ] 1.2.5 Handle errors gracefully and return appropriate response

- [ ] 1.3 Update Debug API documentation
  - [ ] 1.3.1 Add `clean-up` function documentation to `docs/DebugAPI.md`
  - [ ] 1.3.2 Include request/response schema and example usage

- [ ] 1.4 Validation
  - [ ] 1.4.1 Test menu item appears and triggers API call
  - [ ] 1.4.2 Test debug API deletes user config file
  - [ ] 1.4.3 Test debug API deletes media metadata cache directory
  - [ ] 1.4.4 Test error handling when files/directories don't exist
  - [ ] 1.4.5 Verify cleanup works on all supported platforms (Windows, macOS, Linux)
