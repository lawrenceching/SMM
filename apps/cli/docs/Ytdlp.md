# yt-dlp integration

SMM integrated yt-dlp in order to support downloading video from Youtube or Bilibili.

## yt-dlp discovery

SMM discovers yt-dlp binary executable in sequence as below:

1. `ytdlpExecutablePath` in user config
2. If in development mode, find in `bin/yt-dlp/yt-dlp.exe` in project root folder
3. `bin/yt-dlp/yt-dlp.exe` of SMM installation path
   * Windows: `C:\Users\xxx\AppData\Local\SMM`
   * macOS: `~/Library/Application Support/SMM`
   * Linux: `~/.local/share/SMM`
