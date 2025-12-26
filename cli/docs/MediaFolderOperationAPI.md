# Media Folder Operation API

Media Folder Operation API is designed to update media folder.
Additional to regular fs API, Media Folder Operation API will:
1. Validate file paths are valid and not touch files outside media folder.
2. Notify UI MediaMetadata was updated, so that UI will know to refresh data.

Media Folder Operation API requires "clientId" HTTP header, represent the client (which browser tab or which browser) that commit such operation.


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
