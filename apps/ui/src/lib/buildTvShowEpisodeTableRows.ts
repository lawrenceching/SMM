import type { TvShowEpisodeDataRow, TvShowEpisodeTableRow, TvShowFolderFileRow } from "@/components/TvShowEpisodeTable";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { basename, join } from "@/lib/path";
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan";
import { findAssociatedFiles } from "@/lib/utils";
import { mapTagToFileType } from "@/components/TvShowPanelUtils";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import { mediaFilePathEqual } from "@/lib/mediaFilePathEqual";
import Debug from 'debug'
const debug = Debug('buildTvShowEpisodeTableRows')
const FOLDER_FILE_IDS: TvShowFolderFileRow["id"][] = ["clearlogo", "fanart", "poster", "theme", "nfo"]

function matchFolderFile(files: string[], id: TvShowFolderFileRow["id"]): string | undefined {
  if (!files.length) return undefined
  if (id === "nfo") {
    return files.find((f) => basename(f) === "tvshow.nfo")
  }
  const prefix = `${id}.`
  return files.find((f) => {
    const name = basename(f)
    return name != null && name.startsWith(prefix)
  })
}

/**
 * Build rows for fanart, poster, theme, nfo files
 * @param files
 * @returns 
 */
function buildFolderFileRows(files: string[]): TvShowFolderFileRow[] {

  const rows: TvShowFolderFileRow[] = []
  for (const id of FOLDER_FILE_IDS) {
    const path = matchFolderFile(files, id)
    if (path) rows.push({ id, type: "folderFile", path })
  }

  console.log(`buildFolderFileRows RETURNED: ${JSON.stringify(rows)}`)

  return rows
}

export function buildTvShowEpisodeTableRows(mm: UIMediaMetadata, t: (key: string) => string): TvShowEpisodeTableRow[] {
  const rows: TvShowEpisodeTableRow[] = []

  if (mm.status === "initializing") {
    return [{
      id: "initializing",
      type: "divider",
      text: t ? t('mediaFolder.initializing') : "Initializing",
    }]
  }

  if (mm.status === "folder_not_found") {
    return [{
      id: "folder_not_found",
      type: "divider",
      text: t ? t('mediaFolder.folderNotFound') : "Folder not found",
    }]
  }

  if (mm.status === "error_loading_metadata") {
    return [{
      id: "error_loading_metadata",
      type: "divider",
      text: t ? t('mediaFolder.errorLoadingMetadata') : "Error loading metadata",
    }]
  }

  if (mm.files && mm.mediaFolderPath) {
    rows.push(...buildFolderFileRows(mm.files))
  }

  if (mm.tvShow !== undefined) {
    debug(`use tmdbTvShow to build episode table rows`)
    const rowsFromTmdbTvShow = _buildTvShowEpisodeTableRowsFromTmdb(mm)
    rows.push(...rowsFromTmdbTvShow)
    return rows;
  }

  debug(`empty tmdbTvShow and tvdbTvShow, return empty rows`)
  return rows
}

export function _buildTvShowEpisodeTableRowsFromTmdb(_in_mm: UIMediaMetadata) {

  const rows: TvShowEpisodeTableRow[] = []

  if (!_in_mm.tvShow) {
    return rows
  }

  // Process each season and episode directly from tmdbTvShow
  for (const season of _in_mm.tvShow.seasons || []) {
    const seasonNo = season.season
    const seasonText = season.name || `Season ${seasonNo}`
    rows.push({
      id: `season-${seasonNo}`,
      type: "divider",
      text: seasonText,
    })

    for (const episode of season.episodes || []) {
      const episodeNo = episode.episode
      
      // Find the media file for this episode
      const mediaFile = _in_mm.mediaFiles?.find(
        file => file.seasonNumber === seasonNo && file.episodeNumber === episodeNo
      )
      
      let videoFile: { path: string; newPath?: string } | undefined
      let thumbnailFile: { path: string; newPath?: string } | undefined
      let subtitleFile: { path: string; newPath?: string } | undefined
      let nfoFile: { path: string; newPath?: string } | undefined

      if (mediaFile && _in_mm.mediaFolderPath && _in_mm.files) {
        // Get video file path
        videoFile = {
          path: mediaFile.absolutePath,
          newPath: undefined
        }
        
        // Find associated files
        const associatedFiles = findAssociatedFiles(_in_mm.mediaFolderPath, _in_mm.files, mediaFile.absolutePath)
        
        for (const file of associatedFiles) {
          const filePath = join(_in_mm.mediaFolderPath, file.path)
          const fileType = mapTagToFileType(file.tag)
          
          switch (fileType) {
            case 'poster':
              thumbnailFile = { path: filePath }
              break
            case 'subtitle':
              subtitleFile = { path: filePath }
              break
            case 'nfo':
              nfoFile = { path: filePath }
              break
          }
        }
      }
      
      rows.push({
        season: seasonNo,
        episode: episodeNo,
        type: "episode",
        videoFile: videoFile?.path,
        thumbnail: thumbnailFile?.path,
        subtitle: subtitleFile?.path,
        nfo: nfoFile?.path,
        episodeTitle: episode.name ?? "",
        newVideoFile: videoFile?.newPath,
        newThumbnail: thumbnailFile?.newPath,
        newSubtitle: subtitleFile?.newPath,
        newNfo: nfoFile?.newPath,
        checked: videoFile?.path ? true : false,
      })
    }
  }

  return rows;
}

export function _buildTvShowEpisodeTableRowsFromTvdb(_in_mm: UIMediaMetadata) {
  const rows: TvShowEpisodeTableRow[] = []

  if(!_in_mm.tvShow || !_in_mm.tvShow.seasons) {
    return rows;
  }

  // Process each season and episode directly from tmdbTvShow
  for (const season of _in_mm.tvShow.seasons || []) {
    const seasonNo = season.season
    const seasonText = season.name || `Season ${seasonNo}`
    rows.push({
      id: `season-${seasonNo}`,
      type: "divider",
      text: seasonText,
    })

    for (const episode of season.episodes || []) {
      const episodeNo = episode.episode
      
      // Find the media file for this episode
      const mediaFile = _in_mm.mediaFiles?.find(
        file => file.seasonNumber === seasonNo && file.episodeNumber === episodeNo
      )
      
      let videoFile: { path: string; newPath?: string } | undefined
      let thumbnailFile: { path: string; newPath?: string } | undefined
      let subtitleFile: { path: string; newPath?: string } | undefined
      let nfoFile: { path: string; newPath?: string } | undefined

      if (mediaFile && _in_mm.mediaFolderPath && _in_mm.files) {
        // Get video file path
        videoFile = {
          path: mediaFile.absolutePath,
          newPath: undefined
        }
        
        // Find associated files
        const associatedFiles = findAssociatedFiles(_in_mm.mediaFolderPath, _in_mm.files, mediaFile.absolutePath)
        
        for (const file of associatedFiles) {
          const filePath = join(_in_mm.mediaFolderPath, file.path)
          const fileType = mapTagToFileType(file.tag)
          
          switch (fileType) {
            case 'poster':
              thumbnailFile = { path: filePath }
              break
            case 'subtitle':
              subtitleFile = { path: filePath }
              break
            case 'nfo':
              nfoFile = { path: filePath }
              break
          }
        }
      }
      
      rows.push({
        season: seasonNo,
        episode: episodeNo,
        type: "episode",
        videoFile: videoFile?.path,
        thumbnail: thumbnailFile?.path,
        subtitle: subtitleFile?.path,
        nfo: nfoFile?.path,
        episodeTitle: episode.name ?? "",
        newVideoFile: videoFile?.newPath,
        newThumbnail: thumbnailFile?.newPath,
        newSubtitle: subtitleFile?.newPath,
        newNfo: nfoFile?.newPath,
        checked: videoFile?.path ? true : false,
      })
    }
  }

  return rows
}

export function buildTvShowEpisodeTableRowsForPlan(
    mm: UIMediaMetadata, 
    plan: UIRenameFilesPlan | UIRecognizeMediaFilePlan,
    t: (key: string) => string
): TvShowEpisodeTableRow[] {

    if (mm.status === "initializing") {
      return [{
        id: "initializing",
        type: "divider",
        text: t ? t('mediaFolder.initializing') : "Initializing",
      }]
    }

    if (mm.status === "folder_not_found") {
      return [{
        id: "folder_not_found",
        type: "divider",
        text: t ? t('mediaFolder.folderNotFound') : "Folder not found",
      }]
    }

    if (mm.status === "error_loading_metadata") {
      return [{
        id: "error_loading_metadata",
        type: "divider",
        text: t ? t('mediaFolder.errorLoadingMetadata') : "Error loading metadata",
      }]
    }

    let rows: TvShowEpisodeTableRow[] = buildTvShowEpisodeTableRows(mm, t)

    if(plan.task === "recognize-media-file") {
      if(plan.status === 'preparing') {
        return rows;
      }
      
      return fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    } else if(plan.task === "rename-files") {
      return fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)
    }

    console.log(`buildTvShowEpisodeTableRowsForPlan RETURNED: ${JSON.stringify(rows)}`)

    return rows
}

export function fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(
    _in_rows: TvShowEpisodeTableRow[],
    plan: UIRecognizeMediaFilePlan,
) {

  const rows = structuredClone(_in_rows) as TvShowEpisodeTableRow[]
  const planFilesByKey = new Map(
    plan.files.map((file) => [`${file.season}:${file.episode}`, file] as const),
  )

  for (const row of rows) {
    if (row.type !== 'episode') {
      continue
    }

    const recognizedFile = planFilesByKey.get(`${row.season}:${row.episode}`)

    if (recognizedFile) {
      const existingVideoFile = row.videoFile
      const planPath = recognizedFile.path
      row.videoFile = planPath
      row.newVideoFile = undefined

      const unchanged = existingVideoFile != null
        && planPath != null
        && mediaFilePathEqual(existingVideoFile, planPath)

      if (unchanged) {
        row.checked = false
        row.disabled = true
      } else {
        row.checked = planPath !== undefined
        row.disabled = false
      }
    } else {
      row.checked = false
      row.disabled = true
    }
  }

  for (const recognizedFile of plan.files) {
    const row = rows.find(
      (r) => r.type === 'episode' && r.season === recognizedFile.season && r.episode === recognizedFile.episode,
    )
    if (!row) {
      console.warn(
        `recognized video file ${recognizedFile.path} for season ${recognizedFile.season} episode ${recognizedFile.episode} but not found in episode table rows`,
      )
    }
  }

  return rows

}

export function fillTvShowEpisodeTableRowByRenameFilesPlan(
    _in_rows: TvShowEpisodeTableRow[],
    plan: UIRenameFilesPlan,
) {
  const rows = structuredClone(_in_rows) as TvShowEpisodeDataRow[]
  const renameFiles = plan.files

  for(const renameFile of renameFiles) {
    for(const row of rows) {

      if(row.type !== "episode") {
        continue;
      }

      if(row.videoFile === renameFile.from) {
        row.newVideoFile = renameFile.to;
        row.checked = true;
      }

    }
  }

  return rows;
}