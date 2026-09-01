import type { UIMediaFileTableRow, UIMediaFileFolderRow, UIMediaEpisodeSelection } from "@/components/media/UIMediaFileTable";
import type { MediaMetadata } from "@/lib/mediaFolderFiles"
import { basename, join } from "@/lib/path";
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan";
import { findAssociatedFiles } from "@/lib/utils";
import { mapTagToFileType } from "@/components/tv/TvShowPanelUtils";
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import { mediaFilePathEqual } from "@smm/core/pipeline/mediaFilePathEqual";
import Debug from 'debug'
const debug = Debug('buildTvShowEpisodeTableRows')
const FOLDER_FILE_IDS: UIMediaFileFolderRow["id"][] = ["clearlogo", "fanart", "poster", "theme", "nfo"]

/**
 * Result of building episode rows: rows to render plus the episodes that should
 * be pre-checked for the current plan / preview. Selection state itself stays
 * in the caller; this only describes the derived default.
 */
export interface BuiltTvShowEpisodeTableRows {
  rows: UIMediaFileTableRow[]
  defaultChecked: UIMediaEpisodeSelection[]
}

/** Episodes that currently have a linked video file (base default selection). */
function episodesWithVideoFile(rows: UIMediaFileTableRow[]): UIMediaEpisodeSelection[] {
  const out: UIMediaEpisodeSelection[] = []
  for (const row of rows) {
    if (row.type === "episode" && row.videoFile !== undefined) {
      out.push({ season: row.season, episode: row.episode })
    }
  }
  return out
}

function matchFolderFile(files: string[], id: UIMediaFileFolderRow["id"]): string | undefined {
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
function buildFolderFileRows(files: string[]): UIMediaFileFolderRow[] {

  const rows: UIMediaFileFolderRow[] = []
  for (const id of FOLDER_FILE_IDS) {
    const path = matchFolderFile(files, id)
    if (path) rows.push({ id, type: "folderFile", path })
  }

  debug(`buildFolderFileRows RETURNED: %O`, rows)

  return rows
}

export function buildTvShowEpisodeTableRows(
  mm: MediaMetadata,
  uiStatus: UIMediaFolderStatus,
  t: (key: string) => string,
  folderFiles: string[] = [],
): UIMediaFileTableRow[] {
  const rows: UIMediaFileTableRow[] = []

  if (uiStatus === "initializing") {
    return [{
      id: "initializing",
      type: "divider",
      text: t ? t('mediaFolder.initializing') : "Initializing",
    }]
  }

  if (uiStatus === "folder_not_found") {
    return [{
      id: "folder_not_found",
      type: "divider",
      text: t ? t('mediaFolder.folderNotFound') : "Folder not found",
    }]
  }

  if (uiStatus === "error_loading_metadata") {
    return [{
      id: "error_loading_metadata",
      type: "divider",
      text: t ? t('mediaFolder.errorLoadingMetadata') : "Error loading metadata",
    }]
  }

  const folderFileRows = folderFiles.length > 0 && mm.mediaFolderPath
    ? buildFolderFileRows(folderFiles)
    : []
  if (folderFileRows.length > 0) {
    rows.push(...folderFileRows)
  }

  if (mm.tvShow !== undefined) {
    debug(`use tmdbTvShow to build episode table rows`)
    const rowsFromTmdbTvShow = _buildTvShowEpisodeTableRowsFromTmdb(mm, folderFiles)
    rows.push(...rowsFromTmdbTvShow)
    return rows;
  }

  debug(`empty tmdbTvShow and tvdbTvShow, return empty rows`)
  return rows
}

export function _buildTvShowEpisodeTableRowsFromTmdb(_in_mm: MediaMetadata, folderFiles: string[] = []) {

  const rows: UIMediaFileTableRow[] = []

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

      if (mediaFile) {
        videoFile = {
          path: mediaFile.absolutePath,
          newPath: undefined
        }

        if (_in_mm.mediaFolderPath && folderFiles.length > 0) {
          const associatedFiles = findAssociatedFiles(_in_mm.mediaFolderPath, folderFiles, mediaFile.absolutePath)

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
      })
    }
  }

  return rows;
}

export function _buildTvShowEpisodeTableRowsFromTvdb(_in_mm: MediaMetadata, folderFiles: string[] = []) {

  const rows: UIMediaFileTableRow[] = []

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

      if (mediaFile) {
        videoFile = {
          path: mediaFile.absolutePath,
          newPath: undefined
        }

        if (_in_mm.mediaFolderPath && folderFiles.length > 0) {
          const associatedFiles = findAssociatedFiles(_in_mm.mediaFolderPath, folderFiles, mediaFile.absolutePath)

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
      })
    }
  }

  return rows
}

export function buildTvShowEpisodeTableRowsForPlan(
    mm: MediaMetadata,
    uiStatus: UIMediaFolderStatus,
    plan: UIRenameFilesPlan | UIRecognizeMediaFilePlan,
    t: (key: string) => string,
    folderFiles: string[] = [],
): BuiltTvShowEpisodeTableRows {

    if (uiStatus === "initializing") {
      return {
        rows: [{
          id: "initializing",
          type: "divider",
          text: t ? t('mediaFolder.initializing') : "Initializing",
        }],
        defaultChecked: [],
      }
    }

    if (uiStatus === "folder_not_found") {
      return {
        rows: [{
          id: "folder_not_found",
          type: "divider",
          text: t ? t('mediaFolder.folderNotFound') : "Folder not found",
        }],
        defaultChecked: [],
      }
    }

    if (uiStatus === "error_loading_metadata") {
      return {
        rows: [{
          id: "error_loading_metadata",
          type: "divider",
          text: t ? t('mediaFolder.errorLoadingMetadata') : "Error loading metadata",
        }],
        defaultChecked: [],
      }
    }

    const rows: UIMediaFileTableRow[] = buildTvShowEpisodeTableRows(mm, uiStatus, t, folderFiles)

    if(plan.task === "recognize-media-file") {
      if(plan.status === 'preparing') {
        return { rows, defaultChecked: episodesWithVideoFile(rows) }
      }

      return fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    } else if(plan.task === "rename-files") {
      return fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)
    }

    debug(`buildTvShowEpisodeTableRowsForPlan RETURNED: %O`, rows)

    return { rows, defaultChecked: episodesWithVideoFile(rows) }
}

/**
 * Builds the rows shown by the TV show panel together with the episodes that
 * should be pre-checked. Selection defaults are co-located with row building;
 * the selection state itself lives in the caller (TvShowPanel).
 */
export function buildTvShowEpisodeTableRowsForPanel(
    mm: MediaMetadata,
    uiStatus: UIMediaFolderStatus,
    plan: UIRenameFilesPlan | UIRecognizeMediaFilePlan | undefined,
    t: (key: string) => string,
    folderFiles: string[] = [],
): BuiltTvShowEpisodeTableRows {

    if (plan === undefined) {
      // No plan → no preview checkboxes; no episodes are pre-selected.
      return {
        rows: buildTvShowEpisodeTableRows(mm, uiStatus, t, folderFiles),
        defaultChecked: [],
      }
    }

    return buildTvShowEpisodeTableRowsForPlan(mm, uiStatus, plan, t, folderFiles)
}

export function fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(
    _in_rows: UIMediaFileTableRow[],
    plan: UIRecognizeMediaFilePlan,
): BuiltTvShowEpisodeTableRows {

  const rows = structuredClone(_in_rows) as UIMediaFileTableRow[]
  const defaultChecked: UIMediaEpisodeSelection[] = []
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
        row.disabled = true
      } else {
        row.disabled = false
        if (planPath !== undefined) {
          defaultChecked.push({ season: row.season, episode: row.episode })
        }
      }
    } else {
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

  return { rows, defaultChecked }
}

export function fillTvShowEpisodeTableRowByRenameFilesPlan(
    _in_rows: UIMediaFileTableRow[],
    plan: UIRenameFilesPlan,
): BuiltTvShowEpisodeTableRows {
  const rows = structuredClone(_in_rows) as UIMediaFileTableRow[]
  const defaultChecked: UIMediaEpisodeSelection[] = []
  const renameFiles = plan.files

  for (const row of rows) {
    if (row.type !== "episode") {
      continue
    }
    row.newVideoFile = undefined
    row.disabled = undefined
  }

  for(const renameFile of renameFiles) {
    for(const row of rows) {

      if(row.type !== "episode") {
        continue;
      }

      if(row.videoFile === renameFile.from) {
        row.newVideoFile = renameFile.to;
        row.disabled = false;
        if (!defaultChecked.some(
          (e) => e.season === row.season && e.episode === row.episode,
        )) {
          defaultChecked.push({ season: row.season, episode: row.episode })
        }
      }

    }
  }

  for (const row of rows) {
    if (row.type !== "episode" || !row.videoFile) {
      continue
    }
    if (!row.newVideoFile) {
      row.disabled = true
    }
  }

  return { rows, defaultChecked };
}