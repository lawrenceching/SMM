# Media Folder Initialization

Media folder initialization is the process to recognize media folder and files when user open/import a media folder or media library.

It basically mean:
1. To recognize what TV show or movie the folder is 
2. For TV show, to recognize the video file for each TV show episode
3. For movie, to recoginze the video file for movie

## How it work

1. In `ui/src/AppV2.tsx`, post `EVENT_ON_MEDIA_FOLDER_IMPORTED` event when user open media folder or media library
2. `ui/src/hooks/useEventHandlers` dispatched the event to `ui/src/hooks/eventhandlers/useInitializeMediaFolderEventHandler.ts`
3. `useInitializeMediaFolderEventHandler.ts` recognize the media and upodate the media metadata

## Ways of recognize media

This section lists the way to recognize the media folder.

### NFO

The NFO files are used store info for TV show and movie.

If the folder contains `tvshow.nfo`, it's a TV show folder. And the rest of nfo files stores the episode info.

Example TV show folder structure

```
├── tvshow.nfo
├── 古见同学有交流障碍症 - S01E01.mkv
├── 古见同学有交流障碍症 - S01E01.nfo
├── 古见同学有交流障碍症 - S01E02.mkv
├── 古见同学有交流障碍症 - S01E02.nfo
```

If folder contains one nfo file in the folder root, and the nfo contains `<movie></movie>` element, it's a movie folder.

Example movie folder structure

```
├── 夺命小丑2 (2025).nfo
├── 夺命小丑2 (2025).mp4
```

### TMDB ID in folder name

For folder name contains TMDB ID, such as `爱杀宝贝 (2012) [tmdbid=73598]`, we can use the TMDB ID and query media info from TMDB database. According to the TMDB response, we can identify the TV show or movie for the folder.

### Best Match of Folder Name

Search TMDB using the folder name as a keyword. If exactly one TV show or movie is found whose name exactly matches the folder name, use that as the media for this folder.

