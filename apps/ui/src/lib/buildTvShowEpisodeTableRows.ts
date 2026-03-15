import type { TvShowEpisodeDataRow, TvShowEpisodeTableRow, TvShowFolderFileRow } from "@/components/TvShowEpisodeTable";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan";
import { buildSeasonsModelFromMediaMetadata, buildSeasonsByRecognizeMediaFilePlan, buildSeasonsByRenameFilesPlan } from "@/components/TvShowPanelUtils";
import { basename } from "@/lib/path";
import type { TFunction } from "i18next";
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan";

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

  const seasons = buildSeasonsModelFromMediaMetadata(mm)
  if (!seasons) {
    return rows
  }

  for (const seasonModel of seasons) {
    const seasonNo = seasonModel.season.season_number
    const seasonText = seasonModel.season.name || `Season ${seasonNo}`
    rows.push({
      id: `season-${seasonNo}`,
      type: "divider",
      text: seasonText,
    })

    for (const episodeModel of seasonModel.episodes) {
      const episodeNo = episodeModel.episode.episode_number
      const videoFile = episodeModel.files.find((file) => file.type === "video")
      const thumbnailFile = episodeModel.files.find((file) => file.type === "poster")
      const subtitleFile = episodeModel.files.find((file) => file.type === "subtitle")
      const nfoFile = episodeModel.files.find((file) => file.type === "nfo")
      rows.push({
        season: seasonNo,
        episode: episodeNo,
        type: "episode",
        videoFile: videoFile?.path,
        thumbnail: thumbnailFile?.path,
        subtitle: subtitleFile?.path,
        nfo: nfoFile?.path,
        episodeTitle: episodeModel.episode.name ?? "",
        newVideoFile: videoFile?.newPath,
        newThumbnail: thumbnailFile?.newPath,
        newSubtitle: subtitleFile?.newPath,
        newNfo: nfoFile?.newPath,
        checked: false,
      })
    }
  }

  return rows
}

export function buildTvShowEpisodeTableRowsForPlan(
    mm: UIMediaMetadata, 
    plan: RenameFilesPlan | UIRecognizeMediaFilePlan,
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
  }

  return rows;

}

export function fillTvShowEpisodeTableRowByRenameFilesPlan(
    _in_rows: TvShowEpisodeTableRow[],
    plan: RenameFilesPlan,
) {
  const rows = structuredClone(_in_rows) as TvShowEpisodeDataRow[]
  const renameFiles = plan.files

  for(const renameFile of renameFiles) {
    for(const row of rows) {
      if(row.videoFile === renameFile.from) {
        row.newVideoFile = renameFile.to;
      }
    }
  }

  return rows;
}