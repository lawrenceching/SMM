import type { TvShowEpisodeDataRow, TvShowEpisodeTableRow, TvShowFolderFileRow } from "@/components/TvShowEpisodeTable";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { basename, join } from "@/lib/path";
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan";
import { findAssociatedFiles } from "@/lib/utils";
import { mapTagToFileType } from "@/components/TvShowPanelUtils";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";

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

function buildFolderFileRows(files: string[]): TvShowFolderFileRow[] {
  const rows: TvShowFolderFileRow[] = []
  for (const id of FOLDER_FILE_IDS) {
    const path = matchFolderFile(files, id)
    if (path) rows.push({ id, type: "folderFile", path })
  }
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

  if (!mm.tmdbTvShow) {
    return rows
  }

  // Process each season and episode directly from tmdbTvShow
  for (const season of mm.tmdbTvShow.seasons || []) {
    const seasonNo = season.season_number
    const seasonText = season.name || `Season ${seasonNo}`
    rows.push({
      id: `season-${seasonNo}`,
      type: "divider",
      text: seasonText,
    })

    for (const episode of season.episodes || []) {
      const episodeNo = episode.episode_number
      
      // Find the media file for this episode
      const mediaFile = mm.mediaFiles?.find(
        file => file.seasonNumber === seasonNo && file.episodeNumber === episodeNo
      )
      
      let videoFile: { path: string; newPath?: string } | undefined
      let thumbnailFile: { path: string; newPath?: string } | undefined
      let subtitleFile: { path: string; newPath?: string } | undefined
      let nfoFile: { path: string; newPath?: string } | undefined

      if (mediaFile && mm.mediaFolderPath && mm.files) {
        // Get video file path
        videoFile = {
          path: mediaFile.absolutePath,
          newPath: undefined
        }
        
        // Find associated files
        const associatedFiles = findAssociatedFiles(mm.mediaFolderPath, mm.files, mediaFile.absolutePath)
        
        for (const file of associatedFiles) {
          const filePath = join(mm.mediaFolderPath, file.path)
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
      if(plan.status === 'loading') {
        return rows;
      }
      
      return fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    } else if(plan.task === "rename-files") {
      return fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)
    }

    return rows
}

export function fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(
    _in_rows: TvShowEpisodeTableRow[],
    plan: UIRecognizeMediaFilePlan,
) {

  const rows = structuredClone(_in_rows) as TvShowEpisodeDataRow[]
  const recognizedFiles = plan.files

  for(const recognizedFile of recognizedFiles) {
    const row: TvShowEpisodeDataRow | undefined = rows.find((row) => row.season === recognizedFile.season && row.episode === recognizedFile.episode) as TvShowEpisodeDataRow
    if(!row) {
      console.warn(`recognized video file ${recognizedFile.path} for season ${recognizedFile.season} episode ${recognizedFile.episode} but not found in episode table rows`)
      continue
    }
    if(row) {
      row.videoFile = recognizedFile.path;
      row.newVideoFile = undefined;
    }

    if(row.videoFile === undefined) {
      row.checked = false;
    }

  }

  return rows;

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