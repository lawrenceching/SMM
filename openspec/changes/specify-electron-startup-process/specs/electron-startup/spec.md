# Electron Startup Specification

## ADDED Requirements

### Requirement: Development Mode Detection
The Electron wrapper MUST use `is.dev` from `@electron-toolkit/utils` to determine if running in development mode.

#### Scenario: Development mode detection
- **WHEN** Electron application starts
- **AND** `is.dev` returns `true`
- **THEN** the application runs in development mode
- **AND** uses development-specific paths and configurations

#### Scenario: Production mode detection
- **WHEN** Electron application starts
- **AND** `is.dev` returns `false`
- **THEN** the application runs in production mode
- **AND** uses production-specific paths and configurations

### Requirement: CLI Executable Path Resolution
The system MUST resolve the CLI executable path in production mode only.

#### Scenario: CLI path in production mode
- **WHEN** application runs in production mode (`is.dev === false`)
- **AND** CLI executable path is needed
- **THEN** CLI executable path resolves to `{process.resourcesPath}/cli.exe`
- **AND** uses the bundled executable from Electron's resources folder

#### Scenario: CLI path not needed in development mode
- **WHEN** application runs in development mode (`is.dev === true`)
- **THEN** CLI executable path resolution is not performed
- **AND** no CLI process is started

### Requirement: Public Folder Path Resolution
The system MUST resolve the public folder path in production mode only.

#### Scenario: Public folder path in production mode
- **WHEN** application runs in production mode (`is.dev === false`)
- **AND** public folder path is needed for CLI startup
- **THEN** public folder path resolves to `{process.resourcesPath}/public`
- **AND** uses the bundled public folder from Electron's resources folder

#### Scenario: Public folder path not needed in development mode
- **WHEN** application runs in development mode (`is.dev === true`)
- **THEN** public folder path resolution is not performed
- **AND** UI is served by Vite dev server

### Requirement: Port Allocation
The system MUST allocate a free port for the CLI server to use in production mode.

#### Scenario: Port allocation on startup in production mode
- **WHEN** Electron application starts in production mode
- **THEN** a free port is found in the range [30000, 65535]
- **AND** the port is stored for use by the CLI process
- **AND** the port is used when starting the CLI executable

#### Scenario: Port allocation in development mode
- **WHEN** Electron application starts in development mode
- **THEN** no port allocation is performed
- **AND** the application connects to Vite dev server on port 5173

#### Scenario: Port allocation failure
- **WHEN** no free port is found in the range [30000, 65535] (production mode only)
- **THEN** an error is thrown
- **AND** the error message indicates no free port was found

### Requirement: CLI Process Startup
The system MUST start the CLI executable as a child process in production mode only.

#### Scenario: CLI startup skipped in development mode
- **WHEN** application runs in development mode
- **AND** startCLI is called
- **THEN** function returns early without starting CLI process
- **AND** logs a message indicating CLI should be started externally
- **AND** no CLI process is spawned

#### Scenario: CLI startup in production mode
- **WHEN** application runs in production mode
- **AND** CLI executable is started
- **THEN** CLI is spawned with arguments: `--staticDir {public_folder_path} --port {allocated_port}`
- **AND** CLI process stdio is piped to prevent console window on Windows
- **AND** CLI process runs in non-detached mode

#### Scenario: CLI process environment
- **WHEN** CLI executable is started
- **THEN** environment variable `LOG_TARGET` is set to `'file'`
- **AND** all other environment variables from the parent process are inherited

#### Scenario: CLI stdout capture
- **WHEN** CLI process outputs to stdout
- **THEN** output is captured and logged with `[cli]` prefix
- **AND** appears in Electron's main process console

#### Scenario: CLI stderr capture
- **WHEN** CLI process outputs to stderr
- **THEN** output is captured and logged as error with `[cli]` prefix
- **AND** appears in Electron's main process console

#### Scenario: CLI process error handling
- **WHEN** CLI process fails to start
- **THEN** an error is logged
- **AND** CLI process reference is set to null
- **AND** main window is still created (graceful degradation)

#### Scenario: CLI process exit handling
- **WHEN** CLI process exits
- **THEN** exit code and signal are logged
- **AND** CLI process reference is set to null

### Requirement: Main Window URL Loading
The main window MUST load the appropriate URL based on the execution mode.

#### Scenario: URL loading in development mode
- **WHEN** application runs in development mode
- **AND** main window is created
- **THEN** window loads URL `http://localhost:5173`
- **AND** connects to Vite dev server (assumed to be running externally)

#### Scenario: URL loading in production mode
- **WHEN** application runs in production mode
- **AND** main window is created
- **AND** CLI process has been started and allocated a port
- **THEN** window loads URL `http://localhost:{allocated_port}`
- **AND** uses the port allocated for the CLI process

#### Scenario: URL loading error in production mode
- **WHEN** application runs in production mode
- **AND** CLI port has not been allocated
- **AND** main window is created
- **THEN** an error is logged
- **AND** window still attempts to load (graceful degradation)

### Requirement: CLI Process Lifecycle
The system MUST manage the CLI process lifecycle throughout the application lifetime in production mode.

#### Scenario: CLI starts before window creation in production mode
- **WHEN** Electron application is ready in production mode
- **THEN** CLI process is started first
- **AND** main window is created after CLI startup completes
- **AND** if CLI startup fails, window is still created

#### Scenario: Window creation in development mode
- **WHEN** Electron application is ready in development mode
- **THEN** CLI and UI dev processes are started first
- **AND** main window is created after a short delay (to allow dev processes to start)
- **AND** window connects to Vite dev server on port 5173

#### Scenario: CLI cleanup on app quit in production mode
- **WHEN** application is about to quit (`before-quit` event) in production mode
- **THEN** CLI process is killed
- **AND** CLI process reference is set to null

#### Scenario: CLI process prevents duplicate starts
- **WHEN** CLI process is already running
- **AND** startCLI is called again
- **THEN** function returns early without starting a new process
- **AND** logs that CLI is already running

### Requirement: Development Mode Workflow
In development mode, the system MUST start CLI and UI modules via `bun run dev` processes.

#### Scenario: Development mode starts CLI and UI dev processes
- **WHEN** application runs in development mode
- **THEN** Electron wrapper starts CLI module by running `bun run dev` in `cli` folder
- **AND** Electron wrapper starts UI module by running `bun run dev` in `ui` folder
- **AND** both processes are spawned as child processes
- **AND** process output is captured and logged with prefixes `[cli-dev]` and `[ui-dev]`
- **AND** Electron wrapper connects to Vite dev server on port 5173

#### Scenario: CLI dev process lifecycle
- **WHEN** CLI dev process is started in development mode
- **THEN** process is spawned with `bun run dev` command in CLI directory
- **AND** process stdio is piped to capture output
- **AND** process runs in non-detached mode
- **AND** process is tracked for cleanup on app quit

#### Scenario: UI dev process lifecycle
- **WHEN** UI dev process is started in development mode
- **THEN** process is spawned with `bun run dev` command in UI directory
- **AND** process stdio is piped to capture output
- **AND** process runs in non-detached mode
- **AND** process is tracked for cleanup on app quit

#### Scenario: Dev processes cleanup
- **WHEN** application is about to quit in development mode
- **THEN** CLI dev process is killed
- **AND** UI dev process is killed
- **AND** process references are set to null

### Requirement: Production Mode Workflow
In production mode, the system MUST be self-contained and start all required services.

#### Scenario: Production mode is self-contained
- **WHEN** application runs in production mode
- **THEN** CLI executable is bundled with Electron package
- **AND** public folder (UI) is bundled with Electron package
- **AND** CLI process is started automatically by Electron wrapper
- **AND** no external services need to be started manually
