# File Operation APIs


## POST /api/readFile

Request body:
```typescript
interface ReadFileRequestBody {
  path: string;
}
```

Response body:
```typescript
interface ReadFileResponseBody {
  data?: string;
  error?: string;
}
```

* POST /api/writeFile

Write file content to a specified path.

**Request Headers**:
- `X-Trace-Id` (optional): String representation of numeric trace ID counter for request correlation

**Example**:
```
Content-Type: application/json
X-Trace-Id: 1241
```

Request body:
```typescript
interface WriteFileRequestBody {
  path: string;
  data: string;
}
```

Response body:
```typescript
interface WriteFileResponseBody {
  error?: string;
}  
```

**Notes**:
- `X-Trace-Id` is optional - missing header defaults to `0` for backend logging
- Trace ID format is `{event_name}-{counter}` (e.g., `AiSettings-1241`), but only the numeric counter is sent in the header
- Request body remains unchanged - no `traceId` field added
- See `docs/trace-id-format.md` for complete trace ID usage guide

**Example**:
```json
// Request
{
  "path": "C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json",
  "data": "{\"applicationLanguage\":\"zh-CN\",\"tmdb\":{...}}",
  "mode": "overwrite"
}

// Response (success)
{
  "data": {}
}

// Response (error)
{
  "error": "Error Reason: Path is not in allowlist"
}
```

### Validations

1. Path is in allowlist

For all File Operation APIs, we need to validate the path is allowlist, which are:
* path is the user data dir


--

## GET /api/listFiles

List the files under given folder

```typescript

interface ListFilesRequestBody {
  /**
   * Absolute path of folder, it could be POSIX path or Windows path
   */
  path: string;

  /**
   * List only file. If onlyFiles and onlyFolders are set to true, ignore the onlyFolders.
   */
  onlyFiles?: boolean;

  /**
   * List only folder. If onlyFiles and onlyFolders are set to true, ignore the onlyFolders.
   */
  onlyFolders?: boolean;

  /**
   * List hidden files. Default is false
   */ 
  includeHiddenFiles?: boolean;
}

interface ListFilesResponseBody {
  data: {
    /**
     * The resolved path of path parameter in ListFilesRequestBody
     * For example, if user request files in path "~"
     * This field will be "C:\Users\<username>"
     */
    path: string;
    /**
     * List of files and folders in the folder
     */
    items: string[];
  };
  error?: string;
}

```

### Path Resolution

The API resolves special path patterns:
- **"~"** is resolved to the user's home directory (e.g., `C:\Users\<username>` on Windows)
- **"~/"** paths are resolved relative to the home directory (e.g., `~/Documents` → `C:\Users\<username>\Documents`)
- **POSIX-style paths** (starting with "/") are converted to platform-specific format on Windows
- The resolved absolute path is returned in the `data.path` property

--

## GET /api/listDrives

List available drives and network paths on Windows. This endpoint is only available on Windows systems.

**Request:** No request body required.

Response body:
```typescript
interface ListDrivesResponseBody {
  /**
   * Array of available drive paths including:
   * - Local drives (e.g., "C:\\", "D:\\", "E:\\")
   * - Mapped network drives (e.g., "Z:\\")
   * - UNC network paths (e.g., "\\\\server\\share")
   * - Network computer names (e.g., "\\\\computername")
   */
  data: string[];
  /**
   * Error message if the operation fails or if called on a non-Windows system
   */
  error?: string;
}
```

### Behavior

- **Windows:** Returns an array containing:
  1. All available local drive letters (A-Z) that exist and are accessible
  2. Mapped network drives (both drive letter and UNC path if available)
  3. Available network shares discovered via `net view` command
- **Non-Windows:** Returns an empty array with an error message indicating the endpoint is only available on Windows

### Notes

- Network drive detection uses Windows `net use` command to find mapped network drives
- Network share discovery uses Windows `net view` command to find available network computers
- Network operations may fail silently if the user doesn't have permissions or if network discovery is disabled
- Results are sorted alphabetically and deduplicated

### Example Response

**Success (Windows):**
```json
{
  "data": [
    "C:\\",
    "D:\\",
    "E:\\",
    "\\\\NAS-SERVER",
    "\\\\NAS-SERVER\\Media",
    "Z:\\"
  ]
}
```

**Error (Non-Windows):**
```json
{
  "data": [],
  "error": "This endpoint is only available on Windows"
}
```

```