# Media Metadata Management

## App Start Up

`ui/src/AppInitializer.tsx`

1. Load userConfig
2. Convert userConfig.folders to UIMediaMetadata

## Import Folder

`ui/src/hooks/eventhandlers/useInitializeMediaFolderEventHandler.ts`
`ui/src/hooks/useEventHandlers.ts`

1. Receive "onMediaFolderImported" event
2. Add UIMediaMetadata with status "initializing"
3. Initialze MediaMetadata, see document `docs/design/media-folder-initialization.md`
4. Move UIMediaMetadata status to "ok"

## Backend Side User Config Update

`userConfig.folders` may changed from backend by various sources.
1. AI Assistant
2. MCP Tool (by external AI Assistant)

When `userConfig.folders` was changed, backend emit "userConfigUpdate"