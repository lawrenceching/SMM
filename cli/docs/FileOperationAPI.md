# File Operation APIs


* POST /api/readFile

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

## Validations

1. Path is in allowlist

For all File Operation APIs, we need to validate the path is allowlist, which are:
* path is the user data dir