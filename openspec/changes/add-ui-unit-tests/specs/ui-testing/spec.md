## ADDED Requirements

### Requirement: Unit Testing Infrastructure
The UI module SHALL provide unit testing capabilities using vitest and React Testing Library.

#### Scenario: Running unit tests
- **WHEN** developer runs `npm test` in the ui module
- **THEN** all unit tests are executed and results are displayed

#### Scenario: Test file discovery
- **WHEN** test files follow naming convention `*.test.ts` or `*.test.tsx`
- **THEN** vitest automatically discovers and runs these tests

#### Scenario: Testing utility functions
- **WHEN** a utility function has corresponding test file (e.g., `Utils.ts` → `Utils.test.ts`)
- **THEN** the test file can import and test the utility function

#### Scenario: Testing React components
- **WHEN** a React component needs testing
- **THEN** React Testing Library and react-dom can be used to render and test the component

### Requirement: Test Coverage for Utility Functions
Utility functions in the UI module SHALL have unit tests that verify their behavior.

#### Scenario: Testing _buildMappingFromSeasonModels with valid data
- **WHEN** _buildMappingFromSeasonModels receives seasons with episodes containing video files
- **THEN** it returns an array mapping season/episode numbers to video file paths

#### Scenario: Testing _buildMappingFromSeasonModels with empty input
- **WHEN** _buildMappingFromSeasonModels receives an empty array
- **THEN** it returns an empty array

#### Scenario: Testing _buildMappingFromSeasonModels with missing video files
- **WHEN** episodes exist but have no video files
- **THEN** those episodes are not included in the mapping result

#### Scenario: Testing _buildMappingFromSeasonModels with multiple seasons
- **WHEN** multiple seasons with episodes are provided
- **THEN** all episodes with video files across all seasons are included in the result
