
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Simple Media Manager (SMM) is a cross-platform media library manager powered by AI. It provides both a desktop application (Electron) and a web UI/server (CLI) for managing TV shows, movies, and other media files.

## Architecture

### Workspace Structure

The project is organized as a monorepo with four main workspaces:

- **core** - Shared TypeScript code available in both frontend and backend (path utilities, type definitions)
- **ui** - React frontend built with Vite, using Shadcn + Tailwind CSS
- **cli** - Server-side Bun.js application that serves the UI and provides REST API
- **electron** - Electron wrapper that packages the UI for desktop distribution

### Key Components

#### Backend (cli/)
- Built with **Hono** framework (lightweight, fast web framework)
- Uses **Bun** runtime for development and building
- API endpoints are organized in `cli/src/route/`:
  - File operations: `ReadFile.ts`, `WriteFile.ts`, `ListFiles.ts`, `ReadImage.ts`
  - Media metadata: `mediaMetadata/` directory (read, write, delete operations)
  - Task handlers: `tasks/HelloTask.ts`, `tasks/ChatTask.ts`
- Server entry point: `cli/server.ts` (main Hono app configuration)
- CLI entry point: `cli/index.ts` (command-line argument parsing, server startup)

#### Frontend (ui/)
- React 19 with TypeScript
- UI components in `ui/src/components/`:
  - `App.tsx` - Main application component
  - `dialog-provider.tsx` - Dialog management
  - `media-metadata-provider.tsx` - Media metadata state management
  - `tvshow-episodes.tsx` - TV show episode display
  - `ai-chatbox.tsx` - AI chat interface
- API integration in `ui/src/api/`

#### Core (core/)
- **Path utilities** (`core/path.ts`): Platform-agnostic path handling for Windows/POSIX
- **Type definitions** (`core/types.ts`): Comprehensive TypeScript interfaces for:
  - Media metadata structures (MediaMetadata, MediaFileMetadata)
  - TMDB API types (TMDBMovie, TMDBTVShow, TMDBTVShowDetails)
  - Rename rules and variables (Plex, Emby, TMM formats)
  - API request/response types
  - User and application configuration

#### Desktop (electron/)
- Uses **electron-vite** for bundling
- Two TypeScript configs: `tsconfig.node.json` (Node/electron main), `tsconfig.web.json` (renderer/preload)
- Wraps the built UI files from `ui/dist`

## Common Commands

### UI Development
```bash
cd ui
bun install           # Install dependencies
bun run dev           # Start dev server (Vite)
bun run build         # Build for production
bun run lint          # Run ESLint
bun run preview       # Preview production build
```

### CLI Development
```bash
cd cli
bun install           # Install dependencies
bun run dev           # Start server in dev mode
bun run start         # Start server
bun run build         # Build to executable
```

### Electron Development
```bash
cd electron
npm run dev           # Start Electron in dev mode
npm run build         # Build Electron app
npm run build:win     # Build for Windows
npm run build:mac     # Build for macOS
npm run build:linux   # Build for Linux
npm run typecheck     # Run TypeScript type checking
```

### Running Unit Tests (Per Module)
```bash
# CLI module (cli/)
cd cli
bun test [testfilename]    # Run a specific test file

# UI module (ui/)
cd ui
bun run test [testfilename]    # Run a specific test file
```

Note: The project follows red-green testing principle - tests should fail when production code is commented out.

## API Design Guidelines

The HTTP API follows specific design principles:

- **RPC Naming Style**: Endpoints use action-based names (e.g., `/readFile`, `/writeMediaMetadata`)
- **Response Format**: Every response contains both `data` and `error` fields:
  - `data`: Contains the response payload on success
  - `error`: Contains error message on failure (format: "Error Reason: detail message")
- **HTTP Status Codes**: Used only for HTTP layer status, NOT business logic:
  - `200`: HTTP request succeeded (business logic success/error determined by `error` field)
  - `400`: Invalid request or validation error
  - `404`: HTTP endpoint not implemented (NOT resource not found)
  - `500`: Server error
  - Resource not found returns 200 with `error: "Error Reason: detail message"`

## API Documentation

Key API endpoints (all POST requests to `/api/*`):

- **File Operations**:
  - `/readFile` - Read file contents
  - `/writeFile` - Write file contents
  - `/listFiles` - List files in directory
  - `/readImage` - Read image and return base64

- **Media Metadata**:
  - `/readMediaMetadata` - Read metadata cache
  - `/writeMediaMetadata` - Write metadata cache
  - `/deleteMediaMetadata` - Delete metadata cache

- **AI Features**:
  - `/chat` - AI chat functionality
  - `/execute` - Execute named tasks (hello, system)

Full API documentation is available in:
- `cli/docs/FileOperationAPI.md`
- `cli/docs/MediaMetadataAPI.md`
- `cli/docs/ReadImageAPI.md`

## Development Guidelines

### Path Handling
Always use the `Path` class from `core/path.ts` for path operations:
- Handles both Windows and POSIX paths
- Platform-agnostic path construction
- Validates paths are within allowed directories
- Works in both Node.js and browser environments

### Type Safety
- All API responses use Zod for validation
- Request/response types are defined in `core/types.ts`
- Media metadata structure is comprehensive with TMDB integration

### Rename Rules
Built-in rename rules for different media servers:
- **Plex** (TV): `{SEASON_FOLDER}/{TV_SHOW_NAME} - S{SEASON_P2}E{EPISODE_P2} - {NAME}.{EXTENSION}`
- **Plex** (Movie): `{NAME} ({RELEASE_YEAR}).{EXTENSION}`
- **TMM**: `{SEASON_FOLDER_SHORT}/{TV_SHOW_NAME} - S{SEASON_P2}E{EPISODE_P2} - {NAME}.{EXTENSION}`
- **Emby**: `{TV_SHOW_NAME} ({RELEASE_YEAR}) [tmdbid={TMDB_ID}]`

Variables available: `SEASON`, `SEASON_P2`, `EPISODE`, `EPISODE_P2`, `NAME`, `TV_SHOW_NAME`, `EXTENSION`, `TMDB_ID`, `RELEASE_YEAR`, `SEASON_FOLDER`, `SEASON_FOLDER_P2`, `SEASON_FOLDER_SHORT`

## Build System

- **UI**: Vite + TypeScript + Tailwind CSS + Shadcn UI
- **CLI**: Bun runtime with TypeScript compilation
- **Electron**: electron-vite with separate configs for main and renderer processes
- **CI/CD**: GitHub Actions (`.github/workflows/build.yml`) builds UI and CLI on push/PR

## Important Configuration

- TypeScript paths configured in `cli/tsconfig.json`:
  - `@/*` maps to `./src/*`
  - `@core/*` maps to `../core/*`
- UI dependencies include `@ai-sdk/react` for AI integration
- Media metadata cached in `metadata/` subdirectory of user data dir

## API Design Guideline

- API Design Guideline is in `cli/docs/ApiDesignGuideline.md`

## Unit Test Guideline

Unit test should be verified in red-green principle, which means:

1. Temporarily break production code in order to let unit test fail
2. Run unit test and check unit test failed with expected error message
3. Recover the production code

In step 2, if unit test still passed or failed with unrelative error message, 
it means the unit test implementation was wrong and didn't test the production code as expected.
