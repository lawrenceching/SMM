# User Configuration Design

## Overview

The user configuration feature allows users to manage application settings through a graphical UI. These settings are persisted to a JSON file (`smm.json`) in the user's data directory and accessed by both the frontend (UI) and backend (CLI) components.

## Supported Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `applicationLanguage` | `LanguageCode` | UI language (`zh-CN`, `zh-HK`, `zh-TW`, `en`) |
| `tmdb` | `TMDBConfig` | TMDB API configuration (host, API key, HTTP proxy) |
| `ai` | `AIConfig` (deprecated) | Old AI provider settings — migrated to `aiProviders` on load |
| `aiProviders` | `OpenAICompatibleConfig[]` | Array of AI provider configurations |
| `selectedAI` | `string` (deprecated) | Old selected AI provider — migrated to `selectedAIProvider` on load |
| `selectedAIProvider` | `string` | Name of the currently selected AI provider |
| `folders` | `string[]` | List of media folder paths opened in SMM |
| `renameRules` | `string[]` | Custom rename rules for media files |
| `dryRun` | `boolean` | Whether dry run mode is enabled |
| `selectedRenameRule` | `string` | Name of the active rename rule |
| `enableMcpServer` | `boolean` | Whether to run the MCP server |
| `mcpHost` | `string` | MCP server host (default: `127.0.0.1`) |
| `mcpPort` | `number` | MCP server port (default: `30001`) |
| `ytdlpExecutablePath` | `string` | Path to yt-dlp executable |
| `ffmpegExecutablePath` | `string` | Path to ffmpeg executable |
| `ytdlpProxy` | `string` | Proxy URL for yt-dlp (HTTP/HTTPS/SOCKS) |
| `ytdlpCookiesPath` | `string` | Path to cookies file for yt-dlp |
| `preferMediaLanguage` | `PreferMediaLanguage` | Preferred language for media folder recognition (`zh-CN`, `en-US`, `ja-JP`) |
| `isAiFeatureEnabled` | `boolean` | Master AI feature toggle (UI-only, localStorage) |

## Architecture

### Component Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI (React)                                   │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ConfigPanel  │  │ GeneralSettings   │  │    AiSettings      │   │
│  │  .tsx       │  │      .tsx         │  │       .tsx         │   │
│  └──────┬──────┘  └────────┬─────────┘  └──────────┬───────────┘   │
│         │                  │                       │                │
│         └──────────────────┼───────────────────────┘                │
│                            │                                        │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              ConfigProvider (React Context)                    │  │
│  │  - userConfig: UserConfig                                     │  │
│  │  - setAndSaveUserConfig(): Promise<void>                      │  │
│  │  - reload(): void                                             │  │
│  └─────────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Layer                                      │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────────┐     │
│  │  hello.ts   │  │  readFile.ts   │  │    writeFile.ts    │     │
│  │(GET dirs)   │  │ (Read config)  │  │   (Save config)    │     │
│  └──────┬──────┘  └────────┬────────┘  └─────────┬──────────┘     │
└─────────┼──────────────────┼──────────────────────┼────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend (CLI - Bun/Hono)                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    HTTP Endpoints                              │  │
│  │  POST /api/execute (task: "hello")  →  Returns userDataDir   │  │
│  │  POST /api/readFile                  →  Reads smm.json        │  │
│  │  POST /api/writeFile                 →  Writes smm.json      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────┐  ┌────────────────────────────┐   │
│  │      HelloTask.ts          │  │      WriteFile.ts           │   │
│  │  - getUserDataDir()       │  │  - Validates path           │   │
│  │  - getAppDataDir()        │  │  - Writes file with Bun     │   │
│  └────────────────────────────┘  │  - Triggers MCP reload      │   │
│                                   └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    File System Storage                               │
│                                                                     │
│  Windows: %APPDATA%\SMM\smm.json                                    │
│  macOS:   ~/Library/Application Support/SMM/smm.json              │
│  Linux:   ~/.config/smm/smm.json                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Initial Load Flow

```
1. App Startup
   │
   ▼
2. ConfigProvider initializes
   │
   ▼
3. Call hello() API
   │ POST /api/execute { name: "hello" }
   │
   ▼
4. HelloTask.executeHelloTask()
   │ - Determine userDataDir from platform
   │ - Return { userDataDir, appDataDir, version }
   │
   ▼
5. Read smm.json via readFile()
   │ POST /api/readFile { path: "<userDataDir>/smm.json" }
   │
   ▼
6. ReadFile.processReadFile()
   │ - Validate path is in allowlist
   │ - Read file with Bun.file()
   │
   ▼
7. Parse JSON and populate userConfig state
   │
   ▼
8. Sync i18n language with config
```

### Save Config Flow

```
1. User modifies settings in UI form
   │
   ▼
2. User clicks Save button
   │
   ▼
3. Component calls setAndSaveUserConfig(traceId, config)
   │
   ▼
4. ConfigProvider.saveUserConfig()
   │ - Build file path: <userDataDir>/smm.json
   │ - Call writeFile() API
   │
   ▼
5. writeFile() API
   │ POST /api/writeFile
   │ { path: "...", data: "...", mode: "overwrite" }
   │
   ▼
6. WriteFile.doWriteFile()
   │ - Validate path is in allowlist
   │ - Write with Bun.write()
   │
   ▼
7. Special handling: If path is smm.json
   │ - Call applyMcpConfig()
   │ - Restart MCP server if settings changed
   │
   ▼
8. Update userConfig state in React
```

## Key Files Reference

### Frontend (UI)

| File | Responsibility |
|------|----------------|
| `apps/ui/src/components/ui/config-panel.tsx` | Main settings panel with tab navigation |
| `apps/ui/src/components/ui/settings/GeneralSettings.tsx` | General settings form (language, TMDB, MCP) |
| `apps/ui/src/components/ui/settings/AiSettings.tsx` | AI provider configuration form |
| `apps/ui/src/components/ui/settings/Feedback.tsx` | Feedback submission form |
| `apps/ui/src/providers/config-provider.tsx` | React context for config state management |
| `apps/ui/src/api/writeFile.ts` | API client for writing files |
| `apps/ui/src/api/readFile.ts` | API client for reading files |
| `apps/ui/src/api/readUserConfig.ts` | Helper to read and parse user config |
| `apps/ui/src/api/hello.ts` | API client for hello task |

### Backend (CLI)

| File | Responsibility |
|------|----------------|
| `apps/cli/server.ts` | Hono server with route registration |
| `apps/cli/tasks/HelloTask.ts` | Returns user data directory and app info |
| `apps/cli/src/route/WriteFile.ts` | Handles file write requests |
| `apps/cli/src/route/ReadFile.ts` | Handles file read requests |
| `apps/cli/src/utils/config.ts` | `getUserDataDir()`, `getUserConfigPath()` |
| `apps/cli/src/route/path-validator.ts` | Validates paths against allowlist |

### Core (Shared Types)

| File | Responsibility |
|------|----------------|
| `packages/core/types.ts` | `UserConfig`, `TMDBConfig`, `AIConfig`, `OpenAICompatibleConfig` |

## Path Security

The backend implements path allowlisting to prevent unauthorized file access:

1. **Allowlist Construction** (`path-validator.ts`):
   - User data directory (`<userDataDir>`)
   - All configured media folders from `smm.json`

2. **Validation Process**:
   - All file operations validate the target path
   - Path must start with an allowlisted prefix
   - Paths are normalized to POSIX format for comparison

3. **Default Config Location**:
   - Always allowed since it's in the user data directory

## MCP Server Integration

MCP server lifecycle is managed via dedicated HTTP API endpoints:
- `PUT /api/mcp/start` — Start MCP server
- `PUT /api/mcp/stop` — Stop MCP server
- `GET /api/mcp/status` — Query real-time state

The UI (`McpIndicator`) optimistically updates and calls these APIs directly, rather than relying on fire-and-forget writes to `smm.json`.

## Error Handling

1. **API Response Format**:
   - Success: `{ data: ... }`
   - Error: `{ error: "Error Reason: detail message" }`

2. **HTTP Status Codes**:
   - `200`: Success
   - `400`: Validation error or business logic error
   - `500`: Server error

3. **Frontend Error Handling**:
   - ConfigProvider catches errors and stores in `error` state
   - UI components display error messages when needed

## Internationalization

The user config feature supports multiple languages:
- UI labels are translated via i18next
- Translation files: `apps/ui/src/lib/i18n/locales/{lang}/`
- Supported languages: English (`en`), Simplified Chinese (`zh-CN`)

The `applicationLanguage` setting controls which translation bundle is loaded at runtime.

## Future Enhancements

Potential improvements for this feature:

1. **Config Migration**: Add version field to handle config schema migrations
2. **Config Validation**: Add schema validation for all config fields
3. **Remote Config**: Support storing config in cloud for cross-device sync
4. **Config Export/Import**: Allow users to backup and restore settings
5. **Advanced AI Settings**: Add temperature, max tokens, system prompt per provider
