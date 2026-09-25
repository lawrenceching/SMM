# Simple Media Manager

![visitors](https://visitor-badge.laobi.icu/badge?page_id=com.github.lawrenceching.smm)

Simple Media Manger(SMM) is a media library manager powered by AI.

![Screenshot of SMM](./screenshot.png)

Supports Windows, macOS and Linux. 

Download latest version from [Release Page](https://github.com/lawrenceching/fanclub/releases)

## Features

* Rename Files in Plex/Jellyfin/Emby(or more) naming convention
* Scrape poster, fanart, nfo
* Download Video from Youtube or Bilibili
* Video Format Converter
* Edit Tag
* Build-in AI Assistant
* MCP Server

## Docker

| Config | Description |
|--|--|
|30000| Web UI port|
|30001| MCP server port|
| -v | Mount your media folder to any position in container|

```bash
docker run -d \
  --name smm \
  -p 30000:30000 \
  -p 30001:30001 \
  -e SMM_AUTH_TOKEN='ChangeMe123' \
  -v /path/to/your/media:/media:rw \
  lawrenceching/smm:latest
```

Then open `http://localhost:30000`



## Report Issue and Feedabck

[GitHub | Report Bugs](https://github.com/lawrenceching/SMM/issues)
[GitHub | Feedback or Dicussion](https://github.com/lawrenceching/SMM/discussions/landing)

[GitCode | 反馈问题 | 中国大陆](https://gitcode.com/lawrenceching/simple-media-manager/issues)
[GitCode | 用户反馈、讨论、社区论坛 | 中国大陆](https://gitcode.com/lawrenceching/simple-media-manager/discussions)

## Development

Maintainers: see [Release process (Electron & Docker)](docs/dev/release.md). End users installing Docker: [docker-install.md](docs/docker-install.md).
