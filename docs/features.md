# Features of SMM

This file lists all features provided by SMM.

And the test status of v1.1.0


| Feature                                          | Type   | Comment |
| ------------------------------------------------ | ------ | ------- |
| Import media folder - Web GUI/Electron           | MANUAL |  DONE   |
| Import media library - Web GUI/Electron          | MANUAL |  DONE   |
|                                                  |        |         |
| Media Folder Initialization                      |        |         |
| test/specs/media-folder-initialization/          |        |         |
| - TV Show - TMDB ID in folder name               |  AUTO  |         |
| - TV Show - nfo                                  |  AUTO  |         |
| - TV Show - Folder Name                          |  AUTO  |         |
| - TV Show - Not able to detect                   |  AUTO  |         |
| - Movie - TMDB ID in folder name                 |  AUTO  |         |
| - Movie - nfo                                    |  AUTO  |         |
| - Movie - Folder Name                            |  AUTO  |         |
| - Movie - Not able to detect                     |  AUTO  |         |
| - TV Show (TVDB) - TVDB ID in folder name        |  AUTO  |         |
| - TV Show (TVDB) - nfo                           |  AUTO  |         |
| - TV Show (TVDB) - Folder Name                   |  AUTO  |         |
| - Movie (TVDB) - TVDB ID in folder name          |  AUTO  |         |
| - Movie (TVDB) - Folder Name                     |  AUTO  |         |
| - Import Library - TV Show, TMDB&TVDB            |  TODO  |         |
| - Import Library - Movie, TMDB&TVDB              |  TODO  |         |
| - Import Library - Music/Audio                   |  TODO  |         |
|                                                  |        |         |
| TV Show - Search TV Show (TMDB, TVDB, Language)  |  AUTO  |         |
| > SearchTvShow.e2e.ts                            |        |         |
| TV Show - Rule Based Rename                      |  AUTO  |         |
| > TVShow-RenameByPlan.e2e.ts                     |        |         |
| TV Show - Scrape                                 |  AUTO  |         |
| > Scrape.e2e.ts                                  |        |         |
| TV Show - Rename Episode Video File              |  AUTO  |         |
| > TVShow-RenameEpisodeFile.e2e.ts                |        |         |
|                                                  |        |         |
| Movie - Search Movie                             |  AUTO  |         |
| > SearchMovie.e2e.ts                             |         |
| Movie - Rule Based Recognize                     |        |         |
| Movie - Rule Based Rename                        |  AUTO  |         |
| Movie - Scrape                                   |  AUTO  |         |
| Movie - Rename Episode Video File                |  AUTO  |         |
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
| Download Bilibili Video                          | MANUAL |         |
| Download Bilibili Episodes                       | MANUAL |         |
| Download Youtube Video                           | MANUAL |         |
| Download Youtube Episodes                        | MANUAL |         |
|                                                  |        |         |
| Settings                                         |        |         |
| Custom TMDB host and API key                     | MANUAL |         |
| Custom TVDB host and API key                     | MANUAL |         |
| DeepSeek                                         | MANUAL |         |
| OpenAPI                                         | MANUAL |         |
| GLM                                         | MANUAL |         |
| Other                                         | MANUAL |         |
|                                                  |        |         |
| Messages |||
| TMDB/TVDB Connectivity |||
| videocaptioner not found |||