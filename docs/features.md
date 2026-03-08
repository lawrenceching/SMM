# Features of SMM

This file lists all features provided by SMM.

And the test status of v1.1.0


| Feature                                          | Type   | Comment |
| ------------------------------------------------ | ------ | ------- |
| Import media folder - Web GUI/Electron           | MANUAL |  DONE   |
| Import media library - Web GUI/Electron          | MANUAL |  DONE   |
|                                                  |        |         |
| Media Folder Initialization                      |        |         |
| ---- TV Show - TMDB ID in folder name            |  AUTO  |         |
| ---- TV Show - nfo                               |  AUTO  |         |
| ---- TV Show - Folder Name                       |  AUTO  |         |
| ---- TV Show - Not able to detect                |  AUTO  |         |
| ---- Movie - TMDB ID in folder name              |  AUTO  |         |
| ---- Movie - nfo                                 |  AUTO  |         |
| ---- Movie - Folder Name                         |  AUTO  |         |
| ---- Movie - Not able to detect                  |  AUTO  |         |
|                                                  |        |         |
| TV Show - Search TV Show                         |  AUTO  |         |
| TV Show - Rule Based Recognize                   |        | If rule based recognition work, it worked in folder initialization. Need furture considerataion of this scenario        |
| TV Show - Rule Based Rename                      |  AUTO  |         |
| TV Show - Scrape                                 |  AUTO  |         |
| TV Show - Rename Episode Video File              |        |         |
|                                                  |        |         |
| Movie - Search Movie                             |  AUTO  |         |
| Movie - Rule Based Recognize                     |        |         |
| Movie - Rule Based Rename                        |  AUTO  |         |
| Movie - Scrape                                   |  AUTO  |         |
| Movie - Rename Episode Video File                |  AUTO  |         |
|                                                  |        |         |
| Sidebar - Filter and Sort                        | AUTO   |         |
| Sidebar - Rename Folder                          | AUTO   |         |
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