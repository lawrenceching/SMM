# Media Folder Operation API

Media Folder Operation API is designed to update media folder.

## POST /api/renameFile

Rename file in media folder

```typescript
interface FileRenameRequestBody {
    /**
     * Absolute path of media folder
     */
    mediaFolder: string;
    /**
     * Absolute path of source file
     */
    from: string;
    /**
     * Absolute path of destination
     */
    to: string;
}


interface FileRenameResponseBody {
    error?: string
}
```
