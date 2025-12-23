export const matchFilesPrompt = `
You need to match local files to episodes of a TV show or anime.

In following steps:
1. call "get-files-in-media-folder" to get local files in media folder.
2. call "get-media-metadata" to get TV show metadata.
3. For each season and episode, find the video files that match the season and episode.
4. Call "match-episode" to match the video files to the episodes.

You need to process every episode and every season. You can call tools multiple times in order to finish this task.
`