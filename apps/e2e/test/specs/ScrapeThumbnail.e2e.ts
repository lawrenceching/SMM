import * as fs from 'node:fs'
import { expect } from '@wdio/globals'
import { Path } from "@smm/core";
import { type MediaMetadata, type UserConfig } from "@smm/core/types";
import { join } from "path";
import { createFolderInTestFolder, folder1, folder2, folder5 } from "test/actions/import-folders";
import { setup, updateUserConfig, writeMediaMetadata } from "test/lib/testbed";
import Page from '../pageobjects/page'
import Sidebar from "test/componentobjects/Sidebar";
import TvShowPanelCO from "test/componentobjects/TVShowPanel.co";
import ScrapeDialogCO from 'test/componentobjects/ScrapeDialogCO';
import ConfigDialog from 'test/componentobjects/ConfigDialog';
import Menu from 'test/componentobjects/Menu';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function clickScrapeButtonFromOverview(): Promise<void> {
  const scrapeButtonByTestId = $('[data-testid="scrape-button"]')
  if (await scrapeButtonByTestId.isExisting()) {
    await scrapeButtonByTestId.waitForClickable({ timeout: 5000 })
    await scrapeButtonByTestId.click()
    return
  }

  const labels = ['Scrape', '刮削']
  for (const label of labels) {
    const button = await $(`button=${label}`)
    if (await button.isDisplayed().catch(() => false)) {
      await button.waitForClickable({ timeout: 5000 })
      await button.click()
      return
    }
  }

  throw new Error('Scrape button not found in current panel')
}

async function clickFolderByAnyName(names: string[]): Promise<void> {
  await Sidebar.waitForFoldersToLoad(1, 10000)
  const deduped = Array.from(new Set(names.filter(Boolean)))
  for (const name of deduped) {
    if (await Sidebar.isFolderDisplayed(name)) {
      await Sidebar.clickFolder(name)
      return
    }
  }
  const existing = await Sidebar.getFolders()
  throw new Error(`Cannot find sidebar folder by names: ${deduped.join(', ')}. Existing folders: ${existing.join(', ')}`)
}

function getImagePathWithPrefix(folderPath: string, prefix: string): string | undefined {
  const files = fs.readdirSync(folderPath)
  const fileName = files.find(
    (file) => file.startsWith(`${prefix}.`) && IMAGE_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)),
  )
  return fileName ? join(folderPath, fileName) : undefined
}


async function setPreferLanguage(language: "__unset__" | "zh-CN" | "en-US" | "ja-JP"): Promise<void> {
  await Menu.openConfigDialog()
    await browser.pause(1000)

    await ConfigDialog.waitForDisplayed()
    await browser.pause(1000)

    await ConfigDialog.setPreferMediaLanguage(language)
    console.log(`set prefer media language to zh-CN in ConfigDialog`)
    await browser.pause(1000)

    await ConfigDialog.clickSave()
    await ConfigDialog.pressEscape()
    await browser.pause(1000)
}

describe('Scrape Thumbnail', () => {

  beforeEach(async () => {
    await setup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      openBrowserPage: false,
      resetUserConfig: true,
    })
  })

  afterEach(async () => {
    // await cleanup({
    //   removeMetadataDir: true,
    //   removePlansDir: true,
    //   removeMediaFolders: true,
    //   removeDirInSidebar: true,
    //   resetUserConfig: true,
    // })
  })

  it('scrape thumbnail from TMDB for TV Show', async function () {

    this.timeout(60 * 1000)

    const folder = createFolderInTestFolder({
      ...folder1,
      files: [
        "S01E01.mkv",
      ],
    });

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: Path.posix(folder.path!),
      type: folder.type === 'tvshow' ? 'tvshow-folder' : folder.type === 'movie' ? 'movie-folder' : 'music-folder',
      mediaFiles: [
        {
          absolutePath: Path.posix(join(folder.path!, folder.files[0]!)),
          seasonNumber: 1,
          episodeNumber: 1,
        }
      ],
      tvShow: {
        database: 'TMDB',
        id: '84666',
        name: 'WATATEN!: an Angel Flew Down to Me',
        airDate: "2019-01-08",
        seasons: [
          {
            "season": 0,
            "name": "Specials",
            "episodes": [
              {
                "season": 0,
                "episode": 1,
                "name": "You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister"
              }
            ]
          },
          {
            "season": 1,
            "name": "Season 1",
            "episodes": [
              {
                "season": 1,
                "episode": 1,
                "name": "A Funny, Squirmy Feeling"
              },
              // don't need the rest of episodes in this test
            ]
          }
        ]
      }
    };

    await writeMediaMetadata(mediaMetadata);

    const mediaFolderPosix = Path.posix(folder.path!)
    await updateUserConfig((userConfig: UserConfig) => ({
      ...userConfig,
      folders: [...userConfig.folders, mediaFolderPosix],
    }))


    await browser.pause(2 * 1000)

    await Page.open()

    await Sidebar.getFolderByName(folder1.translations?.title?.['en-US']!)

    await browser.pause(1000)
    await setPreferLanguage('zh-CN')

    await TvShowPanelCO.scrapeButton.waitForClickable()
    await TvShowPanelCO.scrapeButton.click()

    await ScrapeDialogCO.table.waitForDisplayed()
    expect(await ScrapeDialogCO.table.getText()).toContain(`File Status
Poster
Pending
Fanart
Pending
Episode Thumbnails
Pending
nfo
Pending`)

    await ScrapeDialogCO.startButton.click()

    await browser.waitUntil(async () => {
      const text = await ScrapeDialogCO.table.getText()
      return text.includes(`File Status
Poster
Completed
Fanart
Completed
Episode Thumbnails
Completed
nfo
Completed`);
    }, {
      timeout: 10 * 1000,
      interval: 1000,
      timeoutMsg: 'ScrapeDialog did not show Completed status'
    });

    await ScrapeDialogCO.cancelButton.click();

    const thumbnailPath = join(folder.path!, 'S01E01.jpg')
    expect(fs.existsSync(thumbnailPath)).toBe(true)
    expect(fs.statSync(thumbnailPath).size).toBeGreaterThan(0)
    const posterPath = getImagePathWithPrefix(folder.path!, 'poster')
    const fanartPath = getImagePathWithPrefix(folder.path!, 'fanart')
    expect(posterPath).toBeDefined()
    expect(fanartPath).toBeDefined()
    expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
    expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

    const nonEpisodeThumbnailPath = join(folder.path!, 'S01E02.jpg')
    expect(fs.existsSync(nonEpisodeThumbnailPath)).toBe(false)

    // assert the tvshow.nfo file is present
    const tvshowNfoPath = join(folder.path!, 'tvshow.nfo')
    expect(fs.existsSync(tvshowNfoPath)).toBe(true)
    expect(fs.readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到我身边')

    // assert the S01E01 episode nfo file are present
    const s01e01EpisodeNfoPath = join(folder.path!, 'S01E01.nfo')
    expect(fs.existsSync(s01e01EpisodeNfoPath)).toBe(true)
    expect(fs.statSync(s01e01EpisodeNfoPath).size).toBeGreaterThan(0)
    expect(fs.readFileSync(s01e01EpisodeNfoPath, 'utf-8')).toContain('心里痒痒的感觉')
  });

  it('scrape thumbnail from TVDB for TV Show', async function () {

    this.timeout(60 * 1000)

    const folder = createFolderInTestFolder({
      ...folder1,
      files: [
        "S01E01.mkv",
      ],
    });

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: Path.posix(folder.path!),
      type: folder.type === 'tvshow' ? 'tvshow-folder' : folder.type === 'movie' ? 'movie-folder' : 'music-folder',
      mediaFiles: [
        {
          absolutePath: Path.posix(join(folder.path!, folder.files[0]!)),
          seasonNumber: 1,
          episodeNumber: 1,
        }
      ],
      tvShow: {
        database: 'TVDB',
        id: '355969',
        name: 'WATATEN!: an Angel Flew Down to Me',
        airDate: "2019-01-08",
        seasons: [
          {
            "season": 0,
            "name": "Specials",
            "episodes": [
              {
                "season": 0,
                "episode": 1,
                "name": "You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister"
              }
            ]
          },
          {
            "season": 1,
            "name": "Season 1",
            "episodes": [
              {
                "season": 1,
                "episode": 1,
                "name": "A Funny, Squirmy Feeling"
              },
              // don't need the rest of episodes in this test
            ]
          }
        ]
      }
    };

    await writeMediaMetadata(mediaMetadata);

    const mediaFolderPosix = Path.posix(folder.path!)
    await updateUserConfig((userConfig: UserConfig) => ({
      ...userConfig,
      folders: [...userConfig.folders, mediaFolderPosix],
    }))


    await browser.pause(2 * 1000)

    await Page.open()
    await Sidebar.getFolderByName(folder1.translations?.title?.['en-US']!)

    await browser.pause(1000)
    await setPreferLanguage('zh-CN')

    await TvShowPanelCO.scrapeButton.waitForClickable()
    await TvShowPanelCO.scrapeButton.click()

    await ScrapeDialogCO.table.waitForDisplayed()
    expect(await ScrapeDialogCO.table.getText()).toContain(`File Status
Poster
Pending
Fanart
Pending
Episode Thumbnails
Pending
nfo
Pending`)

    await ScrapeDialogCO.startButton.click()

    await browser.waitUntil(async () => {
      const text = await ScrapeDialogCO.table.getText()
      return text.includes(`File Status
Poster
Completed
Fanart
Completed
Episode Thumbnails
Completed
nfo
Completed`);
    }, {
      timeout: 10 * 1000,
      interval: 1000,
      timeoutMsg: 'ScrapeDialog did not show Completed status'
    });

    await ScrapeDialogCO.cancelButton.click();

    const thumbnailPath = join(folder.path!, 'S01E01.jpg')
    expect(fs.existsSync(thumbnailPath)).toBe(true)
    expect(fs.statSync(thumbnailPath).size).toBeGreaterThan(0)
    const posterPath = getImagePathWithPrefix(folder.path!, 'poster')
    const fanartPath = getImagePathWithPrefix(folder.path!, 'fanart')
    expect(posterPath).toBeDefined()
    expect(fanartPath).toBeDefined()
    expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
    expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

    const nonEpisodeThumbnailPath = join(folder.path!, 'S01E02.jpg')
    expect(fs.existsSync(nonEpisodeThumbnailPath)).toBe(false)

    // assert the tvshow.nfo file is present
    const tvshowNfoPath = join(folder.path!, 'tvshow.nfo')
    expect(fs.existsSync(tvshowNfoPath)).toBe(true)
    expect(fs.readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到了我身边')

    // assert the S01E01 episode nfo file are present
    const s01e01EpisodeNfoPath = join(folder.path!, 'S01E01.nfo')
    expect(fs.existsSync(s01e01EpisodeNfoPath)).toBe(true)
    expect(fs.statSync(s01e01EpisodeNfoPath).size).toBeGreaterThan(0)
    expect(fs.readFileSync(s01e01EpisodeNfoPath, 'utf-8')).toContain('心裏癢癢的感覺')

    // assert the S01E01 episode nfo file is not present
    const s01e02EpisodeNfoPath = join(folder.path!, 'S01E02.nfo')
    expect(fs.existsSync(s01e02EpisodeNfoPath)).toBe(false)
  });

  it('scrape thumbnail from TMDB for Movie', async function () {
    this.timeout(60 * 1000)

    const folder = createFolderInTestFolder({
      ...folder2,
      folderName: "哪吒之魔童降世 (2019) {tmdbid=552524}",
      files: ["movie.mkv"],
    })

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: Path.posix(folder.path!),
      type: "movie-folder",
      mediaFiles: [
        {
          absolutePath: Path.posix(join(folder.path!, folder.files[0]!)),
        },
      ],
      movie: {
        database: "TMDB",
        id: "552524",
        name: "哪吒之魔童降世",
      },
    }

    await writeMediaMetadata(mediaMetadata)
    const mediaFolderPosix = Path.posix(folder.path!)
    await updateUserConfig((userConfig: UserConfig) => ({
      ...userConfig,
      folders: [...userConfig.folders, mediaFolderPosix],
    }))

    await Page.open()
    await browser.pause(1000)
    await setPreferLanguage('zh-CN')

    await clickScrapeButtonFromOverview()
    await ScrapeDialogCO.table.waitForDisplayed()
    await ScrapeDialogCO.startButton.waitForClickable()
    await ScrapeDialogCO.startButton.click()


    await browser.waitUntil(async () => {
      const text = await ScrapeDialogCO.table.getText()
      return text.includes(`File Status
Poster
Completed
Fanart
Completed
Episode Thumbnails
Completed
nfo
Completed`);
    }, {
      timeout: 10 * 1000,
      interval: 1000,
      timeoutMsg: 'ScrapeDialog did not show Completed status'
    });

    // await browser.waitUntil(() => {
    //   const hasPoster = hasImageWithPrefix(folder.path!, 'poster')
    //   const hasFanart = hasImageWithPrefix(folder.path!, 'fanart')
    //   const nfoPath = join(folder.path!, 'movie.nfo')
    //   return hasPoster && hasFanart && fs.existsSync(nfoPath) && fs.statSync(nfoPath).size > 0
    // }, {
    //   timeout: 60 * 1000,
    //   interval: 1000,
    //   timeoutMsg: 'Movie TMDB scrape outputs were not generated in time',
    // })

    await ScrapeDialogCO.cancelButton.click()

    const posterPath = getImagePathWithPrefix(folder.path!, 'poster')
    const fanartPath = getImagePathWithPrefix(folder.path!, 'fanart')
    expect(posterPath).toBeDefined()
    expect(fanartPath).toBeDefined()
    expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
    expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

    const movieNfoPath = join(folder.path!, 'movie.nfo')
    expect(fs.existsSync(movieNfoPath)).toBe(true)
    expect(fs.statSync(movieNfoPath).size).toBeGreaterThan(0)
    expect(fs.readFileSync(movieNfoPath, 'utf-8')).toContain('<tmdbid>552524</tmdbid>')
  })

  it('scrape thumbnail from TVDB for Movie', async function () {
    this.timeout(60 * 1000)

    const folder = createFolderInTestFolder({
      ...folder5,
      files: ["The Dark Knight [1080P].mkv"],
    })

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: Path.posix(folder.path!),
      type: "movie-folder",
      mediaFiles: [
        {
          absolutePath: Path.posix(join(folder.path!, folder.files[0]!)),
        },
      ],
      movie: {
        database: "TVDB",
        id: "116",
        name: folder5.translations?.title?.['en-US'] ?? "The Dark Knight",
      },
    }

    await writeMediaMetadata(mediaMetadata)
    const mediaFolderPosix = Path.posix(folder.path!)
    await updateUserConfig((userConfig: UserConfig) => ({
      ...userConfig,
      folders: [...userConfig.folders, mediaFolderPosix],
    }))

    await Page.open()
    await browser.pause(1000)
    await setPreferLanguage('zh-CN')

    await clickScrapeButtonFromOverview()
    await ScrapeDialogCO.table.waitForDisplayed()
    await ScrapeDialogCO.startButton.waitForClickable()
    await ScrapeDialogCO.startButton.click()

    await browser.waitUntil(async () => {
      const text = await ScrapeDialogCO.table.getText()
      return text.includes(`File Status
Poster
Completed
Fanart
Completed
Episode Thumbnails
Completed
nfo
Completed`);
    }, {
      timeout: 10 * 1000,
      interval: 1000,
      timeoutMsg: 'ScrapeDialog did not show Completed status'
    });

    await ScrapeDialogCO.cancelButton.click()

    const posterPath = getImagePathWithPrefix(folder.path!, 'poster')
    const fanartPath = getImagePathWithPrefix(folder.path!, 'fanart')
    expect(posterPath).toBeDefined()
    expect(fanartPath).toBeDefined()
    expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
    expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

    const movieNfoPath = join(folder.path!, 'movie.nfo')
    expect(fs.existsSync(movieNfoPath)).toBe(true)
    expect(fs.statSync(movieNfoPath).size).toBeGreaterThan(0)
    const movieNfoText = fs.readFileSync(movieNfoPath, 'utf-8')
    expect(movieNfoText.includes('<tvdbid>116</tvdbid>') || movieNfoText.includes('type="tvdb"')).toBe(true)
  })


});