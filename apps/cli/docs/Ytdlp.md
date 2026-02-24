# yt-dlp integration

SMM integrated yt-dlp in order to support downloading video from Youtube or Bilibili.

## yt-dlp discovery

SMM discovers yt-dlp binary executable in sequence as below:

1. `ytdlpExecutablePath` in user config
2. When running under Electron, bundled resources at `SMM_RESOURCES_PATH/bin/yt-dlp/` (if `SMM_RESOURCES_PATH` is set)
3. Project root folder `bin/yt-dlp/` (development)
4. SMM installation path `bin/yt-dlp/`
   * Windows: `%LOCALAPPDATA%\SMM`
   * macOS: `~/Library/Application Support/SMM`
   * Linux: `~/.local/share/SMM`
