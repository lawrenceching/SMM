# Features of SMM

This file lists all features provided by SMM.

And the test status of v1.1.0


| Feature                                          | Type   | Comment |
| ------------------------------------------------ | ------ | ------- |
| Import media folder - Web GUI/Electron           | MANUAL | DONE    |
| Import media library - Web GUI/Electron          | MANUAL | DONE    |
|                                                  |        |         |
| Media Folder Initialization                      |        |         |
| test/specs/media-folder-initialization/          |        |         |
| - TV Show - TMDB ID in folder name               | AUTO   |         |
| - TV Show - nfo                                  | AUTO   |         |
| - TV Show - Folder Name                          | AUTO   |         |
| - TV Show - Not able to detect                   | AUTO   |         |
| - Movie - TMDB ID in folder name                 | AUTO   |         |
| - Movie - nfo                                    | AUTO   |         |
| - Movie - Folder Name                            | AUTO   |         |
| - Movie - Not able to detect                     | AUTO   |         |
| - TV Show (TVDB) - TVDB ID in folder name        | AUTO   |         |
| - TV Show (TVDB) - nfo                           | AUTO   |         |
| - TV Show (TVDB) - Folder Name                   | AUTO   |         |
| - Movie (TVDB) - TVDB ID in folder name          | AUTO   |         |
| - Movie (TVDB) - Folder Name                     | AUTO   |         |
| - Import Library - TV Show, TMDB&TVDB            | TODO   |         |
| - Import Library - Movie, TMDB&TVDB              | TODO   |         |
| - Import Library - Music/Audio                   | TODO   |         |
|                                                  |        |         |
| TV Show - Search TV Show (TMDB, TVDB, Language)  | AUTO   |         |
| > SearchTvShow.e2e.ts                            |        |         |
| TV Show - Rule Based Rename                      | AUTO   |         |
| > TVShow-RenameByPlan.e2e.ts                     |        |         |
| TV Show - Scrape                                 | AUTO   |         |
| > Scrape.e2e.ts                                  |        |         |
| TV Show - Rename Episode Video File              | AUTO   |         |
| > TVShow-RenameEpisodeFile.e2e.ts                |        |         |
|                                                  |        |         |
| Movie - Search Movie                             | AUTO   |         |
| > SearchMovie.e2e.ts                             |        |         |
| Movie - Rule Based Recognize                     |        |         |
| Movie - Rule Based Rename                        | AUTO   |         |
| Movie - Scrape                                   | AUTO   |         |
| Movie - Rename Episode Video File                | AUTO   |         |
|                                                  |        |         |
| Music/Audio Folder                               |        |         |
| transcribe                                       |        |         |
| > MusicPanel-Transcribe.e2e.ts                   |        |         |
|                                                  |        |         |
| Sidebar - Filter and Sort                        | AUTO   |         |
| Sidebar - Rename Folder                          | AUTO   |         |
| > RenameFolder.e2e.ts                            |        |         |
| Sidebar - Delete Single Folder                   | AUTO   |         |
| Sidebar - Multiple Selection                     | MANUAL |         |
| Sidebar - Multiple Deletion                      | MANUAL |         |
| Sidebar - Open in File Explorer                  | MANUAL |         |
|                                                  |        |         |
| AI Tools - listFiles                             | MANUAL |         |
| AI Tools - isFolderExist                         | MANUAL |         |
| AI Tools - getMediaFolders                       | MANUAL |         |
| AI Tools - getApplicationContext                 | MANUAL |         |
| AI Tools - getMediaMetadata                      | MANUAL |         |
| AI Tools - getEpisodes                           | MANUAL |         |
| AI Tools - renameFolder                          | MANUAL |         |
| AI Tools - Rename Media Files                    | MANUAL |         |
| AI Tools - Recognize Media Files                 | MANUAL |         |
|                                                  |        |         |
| AI Provider - OpenAI                             | MANUAL |         |
| AI Provider - DeepSeek                           | MANUAL |         |
| AI Provider - OpenRouter                         | MANUAL |         |
| AI Provider - GLM                                | MANUAL |         |
| AI Provider - Other                              | MANUAL |         |
|                                                  |        |         |
| MCP Server - get-media-folders                   | AUTO   |         |
| MCP Server - readme                              | AUTO   |         |
| MCP Server - howToRenameEpisodeVideoFiles        | AUTO   |         |
| MCP Server - howToRecognizeEpisodeVideoFiles     | AUTO   |         |
| MCP Server - getEpisode                          | AUTO   |         |
| MCP Server - tmdbSearch                          | AUTO   |         |
| MCP Server - tmdbGetMovie                        | AUTO   |         |
| MCP Server - tmdbGetTvShow                       | AUTO   |         |
|                                                  |        |         |
| StatusBar - Folder Path                          | AUTO   |         |
| StatusBar - MCP Indicator and Popover            | AUTO   |         |
| StatusBar - App Version                          | AUTO   |         |
| StatusBar - Background Job Indicator and Popover | AUTO   |         |
|                                                  |        |         |
| Download Bilibili Video                          | AUTO   |         |
| > MusicPanel-Download.e2e.ts                     |        |         |
| Download Bilibili Episodes                       | AUTO   |         |
| > MusicPanel-Download.e2e.ts                     |        |         |
| Download Bilibili Collection                     | AUTO   |         |
| > MusicPanel-Download.e2e.ts                     |        |         |
| Download Youtube Video                           | AUTO   |         |
| > MusicPanel-Download.e2e.ts                     |        |         |
| DownloadVideoDialog                              |        |         |
| - 无法拉取视频格式 - 超时                        | MANUAL |         |
| - 无法下载视频 - 超时                            |        |         |
| - 无法下载视频 - 格式不可用                      |        |         |
|                                                  |        |         |
|                                                  |        |         |
|                                                  |        |         |
| Settings                                         |        |         |
| Custom TMDB host and API key                     | MANUAL |         |
| > CustomTmdbHost.e2e.ts                          |        |         |
| Custom TVDB host and API key                     | MANUAL |         |
| DeepSeek                                         | MANUAL |         |
| OpenAPI                                          | MANUAL |         |
| GLM                                              | MANUAL |         |
| Other                                            | MANUAL |         |
|                                                  |        |         |
| Background Jobs                                  |        |         |
| - Start/Stop/Remove Download Video Job           |        |         |
| - Failure Notification of Download Video Job     |        |         |
| apps\e2e\test\specs\other\BackgroundJob.e2e.ts   |        |         |
|                                                  |        |         |
| Messages                                         |        |         |
| TMDB/TVDB Connectivity                           |        |         |
| videocaptioner not found                         |        |         |
|                                                  |        |         |
|                                                  |        |         |
|                                                  |        |         |
| Dark Mode                     |        |         |


右键菜单
 - 属性/编辑标签
   > apps\e2e\test\specs\other\MediaFileProperties.e2e.ts
 - 格式转换
   > apps\e2e\test\specs\other\ConvertVideoFormat.e2e.ts
 - 字幕
   > apps\e2e\test\specs\other\Subtitle.e2e.ts
 - 删除
   > apps\e2e\test\specs\music\DeleteFile.e2e.ts

## Test Cases

### DownloadVideoDialog

#### Youtube

1. **下载 Youtube 视频 (Cookies From Browser)**
   - 打开 DownloadVideoDialog
   - 勾选同意条款
   - 输入 Youtube URL
   - 勾选 "从浏览器获取" Cookies, 选择 Firefox
   - 点击 "Go" 按钮拉取视频格式
   - 验证格式列表加载成功
   - 选择预设画质 (如 1080p)
   - 选择下载目录, 点击 "Start"
   - 验证后台任务创建成功, 视频正常下载

2. **Youtube 下载 - 无 Cookies 时 Go 按钮禁用**
   - 打开 DownloadVideoDialog, 勾选同意条款
   - 输入 Youtube URL
   - 验证 "Go" 按钮为禁用状态 (未配置 Cookies)
   - 勾选 "使用 Cookies" 或 "从浏览器获取"
   - 验证 "Go" 按钮变为可用

3. **Youtube 下载 - 格式码选择**
   - 完成格式拉取后
   - 切换到 "格式码" 模式
   - 选择 audio only 格式码
   - 验证补充视频格式码下拉菜单出现
   - 选择补充格式码, 点击 "Start"
   - 验证下载使用 `video_id+audio_id` 格式

#### Bilibili

1. **下载 Bilibili 视频 (回归验证)**
   - 打开 DownloadVideoDialog, 勾选同意条款
   - 输入 Bilibili 视频 URL (非集合/分集)
   - 点击 "Go" 拉取格式
   - 选择预设画质, 选择目录, 点击 "Start"
   - 验证下载任务创建成功

#### Bilibili Episodes

1. **下载 Bilibili 分集 (回归验证)**
   - 输入 Bilibili 分集视频 URL
   - 勾选 "下载分集"
   - 验证分集列表加载, 选择若干集
   - 验证格式码 UI 已隐藏 (仅预设可用)
   - 选择目录, 点击 "Start"
   - 验证每个选中分集各创建一个下载任务

#### Bilibili Collection

1. **下载 Bilibili 合集 (回归验证)**
   - 输入 Bilibili 合集 URL
   - 勾选 "获取视频"
   - 验证合集列表加载
   - 验证格式码 UI 已隐藏
   - 选择目录, 点击 "Start"
   - 验证每个合集视频各创建一个下载任务

