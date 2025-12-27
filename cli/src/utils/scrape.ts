import { getPosterUrl, getBackdropUrl } from './tmdb'
import { stat, writeFile, rename } from 'fs/promises';
import { Nfo } from './nfo';
import { basename, extname, join } from 'path';
import { Path } from '@core/path';
import type { TMDBMovie, TMDBTVShowDetails } from '@core/types';
import pino from 'pino';
import { findMediaMetadata } from './mediaMetadata';
const log = pino()


class Scrape {

    async everythingForTvShow(mediaLocalFolderPath: Path, tvShow: TMDBTVShowDetails) {
        await this.tvShowPoster(mediaLocalFolderPath, tvShow)
        await this.tvShowFanart(mediaLocalFolderPath, tvShow)
        await this.tvShowSeasonPosters(mediaLocalFolderPath, tvShow)
        await this.nfo(mediaLocalFolderPath, tvShow)
        await this.episodeThumbnails(mediaLocalFolderPath, tvShow)
    }

    async everythingForMovie(mediaLocalFolderPath: Path, movie: TMDBMovie) {
        if(movie.poster_path !== null) {
            const posterUrl = getPosterUrl(movie.poster_path)
            if(posterUrl !== null) {
                await this.downloadImage(posterUrl, 'poster', mediaLocalFolderPath)
            }
        }

        if(movie.backdrop_path !== null) {
            const fanartUrl = getBackdropUrl(movie.backdrop_path)    
            if(fanartUrl !== null) {
                await this.downloadImage(fanartUrl, 'fanart', mediaLocalFolderPath)
            }
        }
        
        // TODO: support nfo
    }

    // Common function to download images from URLs
    async downloadImage(url: string, filenameWithoutExt: string, folderPath: Path): Promise<{ success: boolean; filePath?: string; error?: string; skipped?: boolean }> {
        if (!url) {
            return {
                success: false,
                error: 'No URL provided'
            }
        }

        try {
            // Get the file extension from the URL
            const urlParts = url.split('.')
            const extension = urlParts[urlParts.length - 1] || 'jpg'

            // Create filename with extension
            const fullFilename = `${filenameWithoutExt}.${extension}`
            const filePath = folderPath.join(fullFilename).platformAbsPath()

            // Check if file already exists
            try {
                await stat(filePath)
                console.log(`⏭️ ${filenameWithoutExt} already exists, skipping download: ${filePath}`)
                return {
                    success: true,
                    filePath: filePath,
                    skipped: true
                }
            } catch (statError) {
                // File doesn't exist, proceed with download
            }

            console.log(`📥 Downloading ${filenameWithoutExt} from: ${url}`)

            // Download the image
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to download ${filenameWithoutExt}: ${response.status} ${response.statusText}`)
            }

            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            // Write the file
            await writeFile(filePath, buffer)

            console.log(`✅ ${filenameWithoutExt} downloaded successfully to: ${filePath}`)

            return {
                success: true,
                filePath: filePath
            }

        } catch (error) {
            const msg = `Failed to download TMDB image resource: ${url}, filenameWithoutExt=${filenameWithoutExt}, folderPath=${folderPath}`
            throw new Error(msg, {
                cause: error
            })
        }
    }

    /**
     * @param url - The full URL or the part of the image URL. If only part of the URL is provided, the function will try to figure out the backdrop URL.
     * @return the absolute path of downloaded image file
     */
    async downloadTMDBImage(_url: string) {
        let url = _url;
        if(!url.startsWith('http://') &&  !url.startsWith('https://')) {
            /**
             * For example:
             * https://image.tmdb.org/t/p/w1280/AcSg7fq7uM8AfOae5BSB6mXTcc5.jpg
             */
            url = getBackdropUrl(url) || '';
        }

        if(url === '') {
            throw new Error(`Empty image URL`)
        }

        log.info(`Downloading episode thumbnail from ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Failed to download TMDB image from ${url}: HTTP status code ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Get filename from URL
        const urlPath = new URL(url).pathname
        const filename = basename(urlPath)

        // Generate temp file path
        const tmpFilePath = join(require('os').tmpdir(), filename)

        // Write the file
        await writeFile(tmpFilePath, buffer)
        log.info(`TMDB image downloaded to ${tmpFilePath}`)

        return tmpFilePath;
    }

    async tvShowPoster(mediaLocalFolderPath: Path, tvShow: TMDBTVShowDetails) {
        log.info(`Fetching TV Show Poster: mediaLocalFolderPath=${mediaLocalFolderPath}, tvShow=${tvShow.name}`)
        if(!tvShow.poster_path) {
            console.log(`⏭️ No poster found for TV Show: tmdbTvShowId=${tvShow.id}, name=${tvShow.name}`)
            return
        }

        const posterUrl = getPosterUrl(tvShow.poster_path)
        await this.downloadImage(posterUrl || '', 'poster', mediaLocalFolderPath)
    }

    async tvShowFanart(mediaLocalFolderPath: Path, tvShow: TMDBTVShowDetails) {
        if(!tvShow.backdrop_path) {
            console.log(`⏭️ No fanart found for TV Show: tmdbTvShowId=${tvShow.id}, name=${tvShow.name}`)
            return
        }

        const fanartUrl = getBackdropUrl(tvShow.backdrop_path)
        await this.downloadImage(fanartUrl || '', 'fanart', mediaLocalFolderPath)
    }

    async tvShowSeasonPosters(mediaLocalFolderPath: Path, tvShow: TMDBTVShowDetails) {
        const seasonFolder = async function(seasonNumber: number): Promise<Path | null> {
            const possibleFolderNames = [
                `Season ${seasonNumber.toString().padStart(1, '0')}`,
                `Season ${seasonNumber.toString().padStart(2, '0')}`,
            ]

            if(seasonNumber === 0) {
                possibleFolderNames.push('Specials')
            }

            for (const folderName of possibleFolderNames) {
                const folderPath = mediaLocalFolderPath.join(folderName)
                try {
                    console.log(`📁 Checking if season folder exists: ${folderPath}`)
                    await stat(folderPath.platformAbsPath())
                    console.log(`📁 Season folder found: ${folderPath}`)
                    return folderPath
                } catch (error) {
                    continue
                }
            }

            return null;
        }

        for (const season of tvShow.seasons) {
            if(!season.poster_path) {
                console.log(`⏭️ No poster found for season ${season.season_number} of ${tvShow.id}`)
                continue
            }

            const folderPath = await seasonFolder(season.season_number)
            if(!folderPath) {
                console.log(`⏭️ No folder found for season ${season.season_number} of ${tvShow.id}`)
                continue
            }

            const seasonNumberInString = `${season.season_number.toString().padStart(2, '0')}`
            const posterUrl = getPosterUrl(season.poster_path)
            await this.downloadImage(posterUrl || '', `Season${seasonNumberInString}`, folderPath)
        }

    }

    async nfo(mediaLocalFolderPath: Path, tmdbTVShowDetails: TMDBTVShowDetails) {

        // TODO: read existing nfo file and get data from it

            
        const nfo = new Nfo()
        nfo.id = tmdbTVShowDetails.id.toString()
        nfo.title = tmdbTVShowDetails.name
        nfo.originalTitle = tmdbTVShowDetails.original_name
        nfo.showTitle = tmdbTVShowDetails.name
        nfo.plot = tmdbTVShowDetails.overview
        nfo.fanart = getBackdropUrl(tmdbTVShowDetails.backdrop_path) || undefined
        nfo.tmdbid = tmdbTVShowDetails.id.toString()
        nfo.thumbs = []

        if(tmdbTVShowDetails.poster_path) {
            nfo.thumbs.push({
                url: getPosterUrl(tmdbTVShowDetails.poster_path) || '',
                aspect: 'poster'
            })
        }

        for(const season of tmdbTVShowDetails.seasons) {
            if(season.poster_path) {
                nfo.thumbs.push({
                    url: getPosterUrl(season.poster_path) || '',
                    aspect: 'poster',
                    season: season.season_number,
                    type: 'season'
                })
            }
        }

        const nfoPath = mediaLocalFolderPath.join('tvshow.nfo').platformAbsPath()
        log.info(`Writing NFO file to: ${nfoPath}`)
        await writeFile(nfoPath, nfo.toXML())
        console.log(`✅ NFO file written to: ${nfoPath}`)
    }

    async episodeThumbnails(mediaLocalFolderPath: Path, tmdbTVShowDetails: TMDBTVShowDetails) {
        const mm = await findMediaMetadata(mediaLocalFolderPath.abs())
        if(mm === null) {
            log.error(`No media metadata found for media folder ${mediaLocalFolderPath}`)
            return;
        }

        const downloadThumbnailUrl = async (seasonNumber: number, episodeNumber: number) => {
            const season = tmdbTVShowDetails.seasons.find(s => s.season_number === seasonNumber)
            if(!season) {
                log.info(`No TMDBSeason found for season ${seasonNumber}`)
                return undefined
            }
            const episode = season.episodes?.find(e => e.episode_number === episodeNumber)
            if(!episode) {
                log.info(`No TMDBEpisode found for episode ${episodeNumber} of season ${seasonNumber}`)
                return undefined
            }
            const stillPath = episode.still_path
            if(stillPath === null) {
                log.info(`No still path found for episode ${episodeNumber} of season ${seasonNumber}`)
                return undefined
            }
            return await this.downloadTMDBImage(stillPath)
        }

        if(mm.mediaFiles === undefined) {
            log.info(`No media files found or detected in media ${mm.mediaName} ${mm.mediaFolderPath}`)
            return;
        }

        const promises = mm.mediaFiles?.map(async (mf) => {

            if(mf.seasonNumber === undefined || mf.episodeNumber === undefined) {
                log.info(`Skip downloading thumbnail for media file ${mf.absolutePath} because seasonNumber or episodeNumber is undefined: seasonNumber=${mf.seasonNumber}, episodeNumber=${mf.episodeNumber}`)
                return;
            }

            const tmpFilePath = await downloadThumbnailUrl(mf.seasonNumber, mf.episodeNumber);

            if(tmpFilePath === undefined) {
                log.info(`Failed to download thumbnail for media file ${mf.absolutePath}`)
                return;
            }

            const imageFileExt = extname(tmpFilePath)
            const videoFileExt = extname(mf.absolutePath)
            const expectedThumbnailPath = Path.toPlatformPath(mf.absolutePath.replace(videoFileExt, imageFileExt))
            
            try {
                await rename(tmpFilePath, expectedThumbnailPath)
                log.info(`Moved thumbnail from ${tmpFilePath} to ${expectedThumbnailPath}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                log.error(`Failed to move thumbnail from ${tmpFilePath} to ${expectedThumbnailPath}: ${errorMessage}`)
            }

        })
        await Promise.all(promises.filter(p => p !== undefined))
    }

}

const scrape = new Scrape()

export default scrape