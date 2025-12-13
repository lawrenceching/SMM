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
   * List hidden files. Defualt is false
   */ 
  includeHiddenFiles?: boolean
}

interface ListFilesResponseBody {
  data: string[],
  error?: string
}

```