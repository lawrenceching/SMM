# Project Context

## Purpose

Simple Media Manager (SMM) is a cross-platform media library manager powered by AI. It provides both a desktop application (Electron) and a web UI/server (CLI) for managing TV shows, movies, and other media files. The application helps users organize, rename, and manage their media collections with AI-assisted features and integration with The Movie Database (TMDB) for metadata.

## Tech Stack

### Frontend (ui/)
- **React 19** with TypeScript
- **Vite** for build tooling and dev server
- **Tailwind CSS 4** for styling
- **Shadcn UI** + **Radix UI** for component library
- **Socket.IO Client** for real-time communication
- **Zustand** for state management
- **@ai-sdk/react** for AI chat integration
- **React Markdown** with syntax highlighting (Shiki) for AI responses

### Backend (cli/)
- **Bun** runtime for development and production
- **Hono** framework for HTTP server and routing
- **Socket.IO** with **@socket.io/bun-engine** for WebSocket support
- **Zod** for runtime validation and type safety
- **Pino** for structured logging
- **@ai-sdk/openai** for AI capabilities
- **xmlbuilder2** for NFO file generation

### Desktop (electron/)
- **Electron** for desktop application wrapper
- **electron-vite** for bundling
- **electron-builder** for packaging and distribution

### Core (core/)
- Shared TypeScript code used by both frontend and backend
- Platform-agnostic path utilities
- Type definitions for API, media metadata, and TMDB integration

## Project Conventions

### Code Style

**Formatting:**
- **Indentation**: 2 spaces (EditorConfig)
- **Line endings**: LF (Unix-style)
- **Quotes**: Single quotes (Prettier)
- **Semicolons**: None (Prettier)
- **Print width**: 100 characters (Prettier)
- **Trailing commas**: None (Prettier)
- **File encoding**: UTF-8
- **Final newline**: Required

**Linting:**
- **ESLint** with TypeScript ESLint
- React Hooks rules enforced
- React Refresh plugin for Vite

**Naming Conventions:**
- Use descriptive, semantic names
- Follow TypeScript/JavaScript conventions
- Component files: PascalCase (e.g., `App.tsx`)
- Utility files: camelCase (e.g., `useWebSocket.ts`)
- API routes: PascalCase matching action names (e.g., `ReadFile.ts`, `WriteMediaMetadata.ts`)

### Architecture Patterns

**Monorepo Structure:**
- Four main workspaces: `core/`, `ui/`, `cli/`, `electron/`
- Shared code in `core/` accessible via TypeScript path aliases (`@core/*`)
- Each workspace has independent dependencies and build processes

**Client-Server Communication:**
- **Socket.IO** for real-time bidirectional communication
- Event-based messaging with acknowledgements for request-response patterns
- Room-based client management using `clientId` for targeted messaging
- Vite dev server proxies `/socket.io` to backend (port 30000)

**API Design:**
- **RPC-style naming**: Action-based endpoint names (e.g., `/readFile`, `/writeMediaMetadata`)
- **Unified response format**: All responses contain both `data` and `error` fields
- **HTTP status codes**: Used only for HTTP layer status, not business logic
  - `200`: HTTP request succeeded (business logic determined by `error` field)
  - `400`: Invalid request or validation error
  - `404`: HTTP endpoint not implemented (NOT resource not found)
  - `500`: Server error
  - Resource not found returns `200` with `error: "Error Reason: detail message"`

**Path Handling:**
- Always use `Path` class from `core/path.ts` for all path operations
- Platform-agnostic (Windows/POSIX)
- Validates paths are within allowed directories
- Works in both Node.js and browser environments

**Type Safety:**
- All API responses validated with Zod schemas
- Request/response types defined in `core/types.ts`
- Comprehensive TypeScript interfaces for media metadata and TMDB integration

**State Management:**
- React Context for UI state (dialogs, media metadata)
- Zustand for global application state
- Socket.IO events for real-time updates

### Testing Strategy

**Red-Green Testing Principle:**
Unit tests must be verified using the red-green principle:
1. Temporarily break production code to make the unit test fail
2. Run unit test and verify it fails with the expected error message
3. Recover the production code

If the test still passes or fails with an unrelated error message in step 2, the test implementation is incorrect and doesn't properly test the production code.

**Test Organization:**
- Test files co-located with source files (e.g., `ReadFile.test.ts`)
- Use descriptive test names that explain the scenario

### Git Workflow

**Branching Strategy:**
- `main`: Production-ready code
- `develop`: Development branch
- Feature branches for new work

**CI/CD:**
- GitHub Actions workflow (`.github/workflows/build.yml`)
- Builds UI, CLI, and Electron on push/PR to `main` or `develop`
- Supports manual workflow dispatch for releases with tagging

**Change Management:**
- **OpenSpec** for spec-driven development
- Change proposals required for:
  - New features or capabilities
  - Breaking changes (API, schema)
  - Architecture or pattern changes
  - Performance optimizations that change behavior
  - Security pattern updates
- Bug fixes and minor changes can be made directly without proposals

## Domain Context

**Media Library Management:**
- Primary focus: TV shows and movies
- File organization and renaming based on metadata
- Support for multiple media server naming conventions

**Media Metadata:**
- Cached in `metadata/` subdirectory of user data directory
- Integration with **The Movie Database (TMDB)** for:
  - Movie metadata (TMDBMovie)
  - TV show metadata (TMDBTVShow, TMDBTVShowDetails)
  - Episode matching and identification
- NFO file generation for media server compatibility

**Rename Rules:**
Built-in rename rule formats for different media servers:
- **Plex (TV)**: `{SEASON_FOLDER}/{TV_SHOW_NAME} - S{SEASON_P2}E{EPISODE_P2} - {NAME}.{EXTENSION}`
- **Plex (Movie)**: `{NAME} ({RELEASE_YEAR}).{EXTENSION}`
- **TMM**: `{SEASON_FOLDER_SHORT}/{TV_SHOW_NAME} - S{SEASON_P2}E{EPISODE_P2} - {NAME}.{EXTENSION}`
- **Emby**: `{TV_SHOW_NAME} ({RELEASE_YEAR}) [tmdbid={TMDB_ID}]`

Available variables: `SEASON`, `SEASON_P2`, `EPISODE`, `EPISODE_P2`, `NAME`, `TV_SHOW_NAME`, `EXTENSION`, `TMDB_ID`, `RELEASE_YEAR`, `SEASON_FOLDER`, `SEASON_FOLDER_P2`, `SEASON_FOLDER_SHORT`

**AI Features:**
- AI-powered chat interface for user assistance
- AI-assisted file renaming and organization
- Task execution system (hello, chat, system tasks)
- Integration with OpenAI and OpenAI-compatible APIs

**File Operations:**
- Read/write file contents
- List files in directories
- Read images (returned as base64)
- Rename files and folders
- Open files in system file manager
- Path validation for security

## Important Constraints

**Cross-Platform Compatibility:**
- Must work on Windows, macOS, and Linux
- Path handling must be platform-agnostic (use `Path` class from `core/path.ts`)
- Electron packaging supports all three platforms

**Security:**
- Path validation ensures operations are within allowed directories
- File operations restricted to user-specified media folders
- CORS configuration should be restricted in production (currently permissive for development)

**Performance:**
- Media metadata caching to reduce API calls
- Efficient file operations for large media libraries
- Real-time updates via Socket.IO without polling

**Type Safety:**
- All API responses must use Zod for validation
- Type definitions centralized in `core/types.ts`
- No `any` types in production code (TypeScript strict mode)

**Build System:**
- UI builds with Vite (fast HMR in development)
- CLI builds to executable with Bun
- Electron uses electron-vite for separate main/renderer builds
- TypeScript path aliases configured (`@/*`, `@core/*`)

## External Dependencies

**The Movie Database (TMDB) API:**
- Primary source for media metadata (movies, TV shows, episodes)
- Used for scraping and matching media files
- Integration via `cli/src/utils/tmdb.ts` and `cli/src/route/Tmdb.ts`

**OpenAI / OpenAI-Compatible APIs:**
- AI chat functionality via `@ai-sdk/openai`
- Task execution and AI-assisted features
- Configuration via environment variables

**Socket.IO:**
- Real-time bidirectional communication
- Automatic reconnection and transport fallback
- Room-based client management for multi-client support

**Media Server Compatibility:**
- NFO file generation for Plex, Emby, Kodi compatibility
- Support for multiple naming convention formats
- Episode matching and batch renaming operations
