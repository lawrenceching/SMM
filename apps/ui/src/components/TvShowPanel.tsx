import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { TMDBTVShow, TMDBMovie } from "@core/types"

import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { updateMediaFileMetadatas, buildTemporaryRecognitionPlanAsync, handleAiRecognizeConfirm, handlePendingPlans, unlinkEpisode, mediaFolderPathEqual, applyRecognizeMediaFilePlan, rebuildPlanWithSelectedEpisodes, rebuildRenamePlanWithSelectedEpisodes } from "./TvShowPanelUtils"
import { TvShowPanelPrompts } from "./TvShowPanelPrompts"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "./hooks/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/useTvShowFileNameGeneration"
import { useTvShowRenaming } from "./hooks/useTvShowRenaming"
import { useTvShowWebSocketEvents } from "./hooks/useTvShowWebSocketEvents"
import { getTvShowById } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { mapSearchLanguageToTmdb } from "./TMDBSearchbox"
import type { SupportedLanguage } from "@/lib/i18n"
import { useDialogs } from "@/providers/dialog-provider"
import { Path } from "@core/path"
import { usePlansStore, type UIPlan } from "@/stores/plansStore"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import { useTmdbIdFromFolderNamePromptStore } from "@/stores/useTmdbIdFromFolderNamePromptStore"
import { startToRecognizeByTmdbIdInFolderName } from "./hooks/startToRecognizeByTmdbIdInFolderName"
import { TvShowEpisodeTable, type TvShowEpisodeDataRow, type TvShowEpisodeTableRow } from "./TvShowEpisodeTable"
import { TvShowHeaderV2 } from "./TvShowHeaderV2"
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint"
import { buildTvShowEpisodeTableRows, buildTvShowEpisodeTableRowsForPlan } from "@/lib/buildTvShowEpisodeTableRows"
import { useLatest } from "react-use"
import { fetchPlans, savePlan } from "@/actions/planActions"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import { applyRenameFilesPlanForTvShow } from "@/actions/applyRenameFilesPlanForTvShow"
import { renameFiles } from "@/api/renameFiles"

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function TvShowPanel() {
  const { t } = useTranslation(['components', 'errors'])
  const { plans, setPlans, setPlanById, getPlanById } = usePlansStore()
  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadataStoreState()
  const { setSelectedByMediaFolderPath } = useMediaMetadataStoreActions()
  const { updateMediaMetadata, refreshMediaMetadata } = useMediaMetadataActions()
  const { filePickerDialog, scrapeDialog, editMediaFileDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const [openScrape] = scrapeDialog
  const [openEditMediaFile] = editMediaFileDialog
  const { userConfig } = useConfig()
  
  const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
  
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  const [episodeTableLayout, setEpisodeTableLayout] = useState<'simple' | 'detail' | 'preview'>('simple')

  useEffect(() => {
    console.log("[TvShowPanel] selected media folder changed: ", mediaMetadata)
  }, [mediaMetadata])

  const openUseNfoPrompt = useTvShowPromptsStore((state) => state.openUseNfoPrompt)
  const openRuleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRenameFilePrompt)
  const openAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openAiBasedRenameFilePrompt)
  const openAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openAiBasedRecognizePrompt)
  const openRuleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRecognizePrompt)
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)
  const updateAiBasedRenameFileStatus = useTvShowPromptsStore((state) => state.updateAiBasedRenameFileStatus)

  const handleSelectResult = useCallback(async (result: TMDBTVShow | TMDBMovie, searchLanguage: 'zh-CN' | 'en-US' | 'ja-JP') => {
    console.log('[TvShowPanel] handleSelectResult CALLED', {
      timestamp: new Date().toISOString(),
      result,
      searchLanguage,
      stackTrace: new Error().stack
    })

    if (mediaMetadata?.tmdbTvShow?.id === result.id 
      && mediaMetadata?.tmdbTvShow?.name === (result as TMDBTVShow).name) {
      return
    }

    if (!mediaMetadata?.mediaFolderPath) {
      console.error("No media metadata path available")
      return
    }

    const traceId = `tmdb-tvshow-overview-handleSelectResult-${nextTraceId()}`
    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      status: 'updating',
    }, { traceId })

    try {
      const response = await getTvShowById(result.id, searchLanguage)

      if (response.error) {
        console.error("Failed to get TV show details:", response.error)
        updateMediaMetadata(mediaMetadata.mediaFolderPath, {
          ...mediaMetadata,
          status: 'ok',
        }, { traceId })
        return
      }

      if (!response.data) {
        console.error("No TV show data returned")
        updateMediaMetadata(mediaMetadata.mediaFolderPath, {
          ...mediaMetadata,
          status: 'ok',
        }, { traceId })
        return
      }

      console.log('[TvShowPanel] handleSelectResult SUCCESS', {
        timestamp: new Date().toISOString(),
        response,
        stackTrace: new Error().stack
      })

      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        tmdbTvShow: response.data,
        tmdbMediaType: 'tv',
        type: 'tvshow-folder',
        status: 'ok',
      }, { traceId })
    } catch (error) {
      console.error("Failed to update media metadata:", error)
      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        status: 'ok',
      }, { traceId })
    }
  }, [mediaMetadata, userConfig, updateMediaMetadata])

  // Callback handlers for prompts
  const handleUseNfoConfirm = useCallback((tmdbTvShow: TMDBTVShow) => {
    console.log('[TvShowPanel] handleUseNfoConfirm CALLED', {
      timestamp: new Date().toISOString(),
      tmdbTvShow,
      tmdbTvShowId: tmdbTvShow?.id,
      stackTrace: new Error().stack
    })
    if (!tmdbTvShow || !tmdbTvShow.id) {
      console.error('[TvShowPanel] handleUseNfoConfirm called with invalid tmdbTvShow:', tmdbTvShow)
      return
    }
    console.log(`[TvShowPanel] loaded TMDB id from tvshow.nfo: ${tmdbTvShow.id}`);
    const lang = mapSearchLanguageToTmdb((userConfig?.applicationLanguage || "zh-CN") as SupportedLanguage)
    handleSelectResult(tmdbTvShow, lang)
  }, [handleSelectResult, userConfig?.applicationLanguage])

  const handleUseTmdbidFromFolderNameConfirm = useCallback((tmdbTvShow: TMDBTVShow) => {
    console.log('[TvShowPanel] handleUseTmdbidFromFolderNameConfirm CALLED', {
      timestamp: new Date().toISOString(),
      tmdbTvShow,
      tmdbTvShowId: tmdbTvShow?.id,
      stackTrace: new Error().stack
    })
    if (!tmdbTvShow || !tmdbTvShow.id) {
      console.error('[TvShowPanel] handleUseTmdbidFromFolderNameConfirm called with invalid tmdbTvShow:', tmdbTvShow)
      return
    }
    console.log(`[TvShowPanel] loaded TMDB id from folder name: ${tmdbTvShow.id}`);
    const lang = mapSearchLanguageToTmdb((userConfig?.applicationLanguage || "zh-CN") as SupportedLanguage)
    handleSelectResult(tmdbTvShow, lang)
  }, [handleSelectResult, userConfig?.applicationLanguage])

  // Memoize the wrapped openUseNfoPrompt to avoid recreating it on every render
  const openUseNfoPromptWithCallbacks = useCallback((params: {
    nfoData: import("@core/types").TMDBTVShowDetails
    onConfirm?: (tmdbTvShow: import("@core/types").TMDBTVShow) => void
    onCancel?: () => void
  }) => {
    console.log('[TvShowPanel] openUseNfoPromptWithCallbacks CALLED', {
      timestamp: new Date().toISOString(),
      nfoDataId: params.nfoData?.id,
      hasOriginalOnConfirm: !!params.onConfirm,
      stackTrace: new Error().stack
    })
    openUseNfoPrompt({
      ...params,
      onConfirm: handleUseNfoConfirm,
      onCancel: () => {},
    })
  }, [openUseNfoPrompt, handleUseNfoConfirm])

  // Use state hook
  const {
    selectedNamingRule,
    setSelectedNamingRule,
    setIsRenaming,
  } = useTvShowPanelState({ 
    mediaMetadata, 
    toolbarOptions, 
    usePrompts: { 
      openUseNfoPrompt: openUseNfoPromptWithCallbacks
    } 
  })

  // Use file name generation hook
  const { generateNewFileNames } = useTvShowFileNameGeneration({
    mediaMetadata,
    selectedNamingRule,
  })


  const tmdbPromptStore = useTmdbIdFromFolderNamePromptStore()

  const handleTmdbIdDetected = useCallback(async (tmdbId: number, language: 'zh-CN' | 'en-US' | 'ja-JP') => {
    tmdbPromptStore.openPrompt({
      tmdbId,
      mediaName: undefined,
      status: "loading",
      onConfirm: handleUseTmdbidFromFolderNameConfirm,
      onCancel: () => {},
    })

    try {
      const response = await getTvShowById(tmdbId, language)
      
      if (response.data && !response.error) {
        tmdbPromptStore.openPrompt({
          tmdbId,
          mediaName: response.data.name,
          status: "ready",
          onConfirm: handleUseTmdbidFromFolderNameConfirm,
          onCancel: () => {},
        })
      } else {
        tmdbPromptStore.openPrompt({
          tmdbId,
          mediaName: undefined,
          status: "error",
          onConfirm: handleUseTmdbidFromFolderNameConfirm,
          onCancel: () => {},
        })
        toast.error(t('toolbar.queryTmdbFailed'))
      }
    } catch (error) {
      console.error('Failed to get TV show by ID:', error)
      tmdbPromptStore.openPrompt({
        tmdbId,
        mediaName: undefined,
        status: "error",
        onConfirm: handleUseTmdbidFromFolderNameConfirm,
        onCancel: () => {},
      })
      toast.error(t('toolbar.queryTmdbFailed'))
    }
  }, [handleUseTmdbidFromFolderNameConfirm, t])

  useEffect(() => {
    const detection = startToRecognizeByTmdbIdInFolderName(mediaMetadata, userConfig)
    if (detection) {
      handleTmdbIdDetected(detection.tmdbId, detection.language)
    }
  }, [mediaMetadata, userConfig, handleTmdbIdDetected])

  const handleAiRecognizeConfirmCallback = useCallback(async (plan: RecognizeMediaFilePlan) => {
    if (!mediaMetadata) return
    await handleAiRecognizeConfirm(plan, mediaMetadata, updateMediaMetadata, setPlanById)
  }, [mediaMetadata, updateMediaMetadata, setPlanById])

  const handleRuleBasedRecognizePromptConfirmButtonClick = useCallback(async (plan: UIRecognizeMediaFilePlan) => {
    console.log('[TvShowPanel] User clicked the confirm button in RuleBasedRecognizePrompt')
    if (!mediaMetadata) {
      toast.error("No media metadata available")
      return
    }

    if (!plan || !plan.mediaFolderPath) {
      toast.error("Plan not found or invalid")
      return
    }

    try {
      const selectedEpisodes = latestTableData.current
        .filter((row): row is TvShowEpisodeDataRow => row.type === 'episode' && row.checked)
        .map(row => ({ season: row.season, episode: row.episode }))

      const actualPlan = rebuildPlanWithSelectedEpisodes(plan as RecognizeMediaFilePlan, selectedEpisodes)
      const traceId = `TvShowPanel-handleRuleBasedRecognizeConfirm-${nextTraceId()}`
      
      await applyRecognizeMediaFilePlan(actualPlan, mediaMetadata, updateMediaMetadata, { traceId })
      setPlanById(plan.id, { status: 'completed' })
      
      toast.success(t('toolbar.recognizeEpisodesSuccess'))
    } catch (error) {
      console.error('[TvShowPanel] Error applying rule-based recognition:', error)
      toast.error("Failed to apply recognition")
    }
  }, [mediaMetadata, updateMediaMetadata, t])

  // When panel shows a media folder, fetch pending plans so we can open the right prompt (rename or recognize)
  useEffect(() => {

    if (mediaMetadata?.mediaFolderPath) {
      fetchPlans().then((plans) => {
        console.log(`[fetchPlans] fetched ${plans.length} plans`, plans)
        setPlans(plans)
      })
    }
    
  }, [mediaMetadata?.mediaFolderPath, setPlans])

  // Use renaming hook (used for both legacy rename and rename-plan V2 confirm)
  const { startToRenameFiles } = useTvShowRenaming({
    mediaMetadata,
    refreshMediaMetadata,
    setIsRenaming,
  })

  const handleAiBasedRenamePlanConfirm = useCallback(
    async (plan: RenameFilesPlan) => {
      
      if (!mediaMetadata) {
        return
      }
      
      const selectedEpisodePaths = latestTableData.current
        .filter((row): row is TvShowEpisodeDataRow => row.type === 'episode' && row.checked)
        .map(row => row.videoFile)
        .filter(row => row !== undefined)

      const actualPlan = rebuildRenamePlanWithSelectedEpisodes(plan, selectedEpisodePaths)

      setPlanById(plan.id, {status: 'loading'})
      try {
        // TODO: who fill the associated files in the plan so that subtitle files will be renamed together?
        await startToRenameFiles(actualPlan)
        savePlan(plan as UIPlan, {
        onSuccess: (plan) => {
          setPlanById(plan.id, {status: 'completed'})
        },
        onError: (error) => {
          console.error(`[savePlan] Failed to save plan ${plan.id}:`, error)
        },
        })
      } catch(error) {
        console.error(`[TvShowPanel] Failed to execute rename plan ${plan.id}:`, error)
        // TODO: throw error toast
      }
      
      

    },
    [mediaMetadata, updateMediaMetadata, refreshMediaMetadata, t]
  )

  /**
   * Open AI based rename file prompt
   */
  useEffect(() => {
    if (!mediaMetadata?.mediaFolderPath) return
    const plan = plans.find(
      (p): p is UIRenameFilesPlan => 
        p.task === "rename-files" &&
        p.status === "pending" &&
        p.tmp === false &&
        mediaFolderPathEqual(p.mediaFolderPath, mediaMetadata.mediaFolderPath)
    )
    if (plan) {
      console.log(`[TvShowPanel] Detected pending RenameFilesPlan, open AiBasedRenameFilePrompt:`, plan)
      setEpisodeTableLayout('simple')
      openAiBasedRenameFilePrompt({
        status: "wait-for-ack",
        onConfirm: () => handleAiBasedRenamePlanConfirm(plan as RenameFilesPlan),
        onCancel: async () => {
          try {
            setPlanById(plan.id, { status: "rejected" })
          } catch (error) {
            console.error("[TvShowPanel] Error rejecting rename plan:", error)
          }
        },
      })
    } else {
      closeAiBasedRenameFilePrompt()
      // Do not close recognize prompt here; handlePendingPlans manages AiBasedRecognizePrompt.
    }
  }, [plans, mediaMetadata, openAiBasedRenameFilePrompt, closeAiBasedRenameFilePrompt, handleAiBasedRenamePlanConfirm])

  // Use WebSocket events hook
  useTvShowWebSocketEvents({
    mediaMetadata,
    setSelectedMediaMetadataByMediaFolderPath: setSelectedByMediaFolderPath,
    openAiBasedRenameFilePrompt,
    setAiBasedRenameFileStatus: updateAiBasedRenameFileStatus,
    updateMediaMetadata,
  })


  // Handle file selection for episode
  const handleEpisodeFileSelect = useCallback((seasonNumber: number, episodeNumber: number, file: { path: string; isDirectory?: boolean }) => {
    // Don't allow selecting directories
    if (file.isDirectory) {
      toast.error("Directory selection is not allowed. Please select a file.")
      return
    }

    // Validate mediaMetadata is available
    if (!mediaMetadata) {
      toast.error("No media metadata available")
      return
    }

    // Validate files array is available
    if (!mediaMetadata.files) {
      toast.error("Files list is not available")
      return
    }

    // Validate season and episode numbers
    if (seasonNumber === undefined || episodeNumber === undefined) {
      toast.error("Invalid episode: season or episode number is missing")
      return
    }

    // Convert file path to POSIX format
    const filePathInPosix = Path.posix(file.path)

    // Validate the file exists in the media folder files
    if (!mediaMetadata.files.includes(filePathInPosix)) {
      toast.error("Selected file is not in the media folder")
      return
    }

    // Validate mediaFolderPath is available
    if (!mediaMetadata.mediaFolderPath) {
      toast.error("Media folder path is not available")
      return
    }

    // Update media file metadata
    const updatedMediaFiles = updateMediaFileMetadatas(
      mediaMetadata.mediaFiles ?? [],
      filePathInPosix,
      seasonNumber,
      episodeNumber
    )

    // Update media metadata
    const traceId = `TvShowPanel-handleFileSelect-${nextTraceId()}`
    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      mediaFiles: updatedMediaFiles
    }, { traceId })

    toast.success("File added successfully")
  }, [mediaMetadata, updateMediaMetadata])

  // Handle opening file picker for episode
  const handleOpenFilePickerForEpisode = useCallback((seasonNumber: number, episodeNumber: number) => {

    // Validate mediaMetadata is available
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media metadata available")
      return
    }

    // Convert media folder path from POSIX to platform-specific format for the file picker
    const mediaFolderPlatformPath = Path.toPlatformPath(mediaMetadata.mediaFolderPath)

    if (isElectron) {
      // Use native file dialog in Electron environment
      const electron = (window as any).electron
      if (electron?.dialog?.showOpenDialog) {
        electron.dialog.showOpenDialog({
          properties: ['openFile'],
          title: "Select Video File",
          defaultPath: mediaFolderPlatformPath,
          filters: [
            { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        }).then((result: any) => {
          if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
            const selectedFile = {
              path: result.filePaths[0],
              isDirectory: false
            }
            handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
          }
        }).catch((error: Error) => {
          console.error('[handleOpenFilePickerForEpisode] Error opening native dialog:', error)
          toast.error(`Failed to open file dialog: ${error.message}`)
        })
      } else {
        toast.error("Native dialog not available")
      }
    } else {
      // Use custom file picker dialog in web environment
      const fileSelectHandler = (selectedFile: { path: string; isDirectory?: boolean }) => {
        handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
      }

      openFilePicker(fileSelectHandler, {
        title: "Select Video File",
        description: "Choose a video file for this episode",
        selectFolder: false,
        initialPath: mediaFolderPlatformPath
      })
    }
  }, [mediaMetadata, isElectron, openFilePicker, handleEpisodeFileSelect])

  const handleRuleBasedRenameConfirm = useCallback(async (planId: string) => {
    
    const plan = getPlanById(planId)
    
    if (plan) {

      const selectedEpisodePaths = latestTableData.current
        .filter((row): row is TvShowEpisodeDataRow => row.type === 'episode' && row.checked)
        .map(row => row.videoFile)
        .filter(path => path !== undefined)

      const actualPlan = rebuildRenamePlanWithSelectedEpisodes(plan as RenameFilesPlan, selectedEpisodePaths)
      // applyRenameFilesPlanForTvShow calls renameFiles API under the hood
      // and renameFiles API triggers mediaMetadataUpdated socket.io event which will cause app to refresh media metadata
      // Therefore, we don't need to update mediaMetadata here
      await applyRenameFilesPlanForTvShow({ 
        mediaFolderPath: mediaMetadata!.mediaFolderPath!,
        localFiles: mediaMetadata!.files!,
        plan: actualPlan as UIRenameFilesPlan, 
        traceId: `RuleBasedRenameConfirm-${planId}` }, 
        { renameFilesApi: renameFiles }
      )
      setPlanById(planId, { status: 'completed' })
    } else {
      console.error("[TvShowPanel] No temporary rename plan found")
      toast.error("Failed to find rename plan")
    }
  }, [mediaMetadata, t])

  // Handler for rule-based recognition button click
  const handleRuleBasedRecognizeButtonClick = useCallback(() => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    const traceId = `RecognizeEpisodes-${nextTraceId()}`

    // 1. Add tmp plan with loading state so RuleBasedRecognizePrompt shows immediately
    const newPlan: UIRecognizeMediaFilePlan = {
      id: crypto.randomUUID(),
      task: 'recognize-media-file',
      status: 'loading',
      tmp: true,
      mediaFolderPath: mediaMetadata.mediaFolderPath,
      files: [],
    }

    console.log(`[TvShowPanel] openRuleBasedRecognizePrompt() CALLED`)
    openRuleBasedRecognizePrompt({
      tvShowTitle: mediaMetadata.tmdbTvShow?.name ?? '',
      tvShowTmdbId: mediaMetadata.tmdbTvShow?.id ?? 0,
      planId: newPlan.id,
      onConfirm: () => {
        console.log(`[TvShowPanel] RuleBasedRecognizePrompt.onConfirm() CALLED`)
        handleRuleBasedRecognizePromptConfirmButtonClick?.(newPlan)
      },
      onCancel: () => {
        setPlanById(newPlan.id, { status: 'rejected' })
      }
    })
    setPlans(prev => [...prev, newPlan])
   
    // 2. Run recognition in background, then update plan with result
    void buildTemporaryRecognitionPlanAsync(mediaMetadata)
      .then(planData => {
        console.log(`[${traceId}] recognize episodes: `, structuredClone(planData))

        if (planData && planData.files.length > 0) {
          setPlans(prev => {
            const ret = prev.map(plan => {
              if (plan.id === newPlan.id) {
                const updated: UIRecognizeMediaFilePlan = {
                  ...(plan as UIRecognizeMediaFilePlan),
                  status: 'pending',
                  files: planData.files,
                }
                return updated
              }
              return plan
            })
            console.log(`[${traceId}] updated plans: `, structuredClone(ret))
            return ret;
          })

          // RuleBasedRecognizePrompt is opened automatically once plan was created.
          // If user click confirm, go to handleRuleBasedRecognizePromptConfirmButtonClick()

        } else {
          setPlans(prev => {
            return prev.map(plan => {
              if(plan.id === newPlan.id) {
                return { ...plan, status: 'rejected' }
              }
              return plan;
            })
          })
          toast.error(t('toolbar.noRecognizedFiles', { defaultValue: 'No recognized files found' }))
        }
      })
      .catch(err => {
        setPlanById(newPlan.id, { status: 'rejected' })
        toast.error(err instanceof Error ? err.message : 'Recognition failed')
      })
  }, [mediaMetadata, t])

  /**
   * This method was used when the media folder was selected by user,
   * trigger the recognition process automatically.
   * Comment out temporarily because it seems we don't need this.
   */
  // const handleMediaFolderSelected = useCallback((mm: UIMediaMetadata): boolean => {
  //   return onMediaFolderSelected({
  //     mediaMetadata: mm,
  //     openRuleBasedRecognizePrompt,
  //     updateMediaMetadata,
  //   })
  // }, [openRuleBasedRecognizePrompt, updateMediaMetadata])

  const [tableData, setTableData] = useState<TvShowEpisodeTableRow[]>([]);
  const latestTableData = useLatest(tableData)

  const plan = useMemo(() => {
    console.log(`[TvShowPanel] detected plans change: `, structuredClone(plans))
    if(plans.length > 0) {
      
      const plansForThisFolder = plans
          .filter(p => p.mediaFolderPath === mediaMetadata?.mediaFolderPath)
          .filter(p => p.status === 'pending' || p.status === 'loading')

      if(plansForThisFolder.length === 0) {
        return undefined;
      }

      console.log(`Found active plan: `, plansForThisFolder[0])
      return plansForThisFolder[0]

    }
    return undefined;
  }, [plans, mediaMetadata?.mediaFolderPath])

  const previewMode: "rename" | "recognize" | undefined = useMemo(() => {

    if(plan === undefined) {
      return undefined;
    }

    const task = plan.task;
    if(task === 'recognize-media-file') {
      return 'recognize';
    } else if(task === 'rename-files') {
      return 'rename';
    } else {
      console.warn(`[TvShowPanel] previewMode: unknown plan task: ${task}`)
      return undefined;
    }
  }, [plan, mediaMetadata?.mediaFolderPath])

  const previewStatus: "loading" | "ok" | undefined = useMemo(() => {
    if(plan === undefined) {
      return undefined;
    }
    if(plan.status === 'loading') {
      return 'loading';
    } else {
      return 'ok';
    }
  }, [plan])

  useEffect(() => {
    if (!mediaMetadata) return;

    let ret: TvShowEpisodeTableRow[] = [];
    if(plan === undefined) {
      ret = buildTvShowEpisodeTableRows(mediaMetadata, (key: string) => {
       return t(key as any)
      })
    } else {
      ret = buildTvShowEpisodeTableRowsForPlan(mediaMetadata, plan, (key: string) => {
       return t(key as any)
      })
    };

    setTableData(ret);
    
  }, [mediaMetadata, plan, t])

  const handleUnlinkEpisode = useCallback(
    (row: TvShowEpisodeDataRow) => {
      unlinkEpisode({
        season: row.season,
        episode: row.episode,
        mediaMetadata,
        updateMediaMetadata,
        t: t as (key: string, options?: Record<string, unknown>) => string,
      })
    },
    [mediaMetadata, updateMediaMetadata, t]
  )

  const handleEditTagsForRow = useCallback(
    (row: TvShowEpisodeDataRow) => { 
      const seasonNo = row.season;
      const episodeNo = row.episode;

      const videoPath = mediaMetadata?.mediaFiles?.find(f => f.seasonNumber === seasonNo && f.episodeNumber === episodeNo)?.absolutePath
      if (videoPath) {
        openEditMediaFile({ path: videoPath })
      } else {
        console.warn(`[TvShowPanel] handleEditTagsForRow: no video path found for season ${seasonNo} episode ${episodeNo}`)
      }
    },
    [mediaMetadata, openEditMediaFile]
  )
  
  /**
   * Hanlde the event of user click "Select File" context menu in TvShowEpisodeTable
   * App pop up the file-picker-dialog or native file-picker dialog to let user select the video file
   * And then update the mediaMetadata.mediaFiles with the selected video file path for given season and episode
   */
  const handleSelectFileContextMenuClick = useCallback((row: TvShowEpisodeDataRow) => {
      const seasonNo = row.season;
      const episodeNo = row.episode;
      handleOpenFilePickerForEpisode(seasonNo, episodeNo)
  }, [mediaMetadata, openEditMediaFile])

  useEffect(() => {
    if(plan !== undefined) {
      handlePendingPlans({
        pendingPlans: [plan],
        mediaMetadata,
        openRuleBasedRecognizePrompt,
        openAiBasedRecognizePrompt,
        closeAiBasedRecognizePrompt,
        handleAiRecognizeConfirmCallback,
        handleRuleBasedRecognizeConfirmCallback: handleRuleBasedRecognizePromptConfirmButtonClick,
        updatePlan: (planId, status) => {
          setPlanById(planId, { status })
          return Promise.resolve()
        },
        updateMediaMetadata,
        t,
        toast,
      })
    }
  }, [plan])


  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <TvShowPanelPrompts />

      <div className="shrink-0 px-4 pt-4">
        <TvShowHeaderV2
          onSearchResultSelected={handleSelectResult}
          onRecognizeButtonClick={handleRuleBasedRecognizeButtonClick}
          onRenameClick={() => {

            if (!mediaMetadata?.mediaFolderPath) {
              toast.error("No media folder path available")
              return
            }

            setEpisodeTableLayout('simple')
            
            // 1. Add tmp plan with loading state so RuleBasedRenameFilePrompt shows immediately
            const newPlan: UIPlan = {
              id: crypto.randomUUID(),
              task: 'rename-files',
              status: 'loading',
              tmp: true,
              mediaFolderPath: mediaMetadata.mediaFolderPath,
              files: [],
            };
            setPlans(prev => [...prev, newPlan]);

            console.log(`[TvShowPanel] created new tmp rename plan: ${newPlan.id}`);

            openRuleBasedRenameFilePrompt({
              toolbarOptions,
              selectedNamingRule,
              setSelectedNamingRule,
              planId: newPlan.id,
              onConfirm: () => {
                handleRuleBasedRenameConfirm(newPlan.id)
              },
              onCancel: async () => {
                try {
                  await setPlanById(newPlan.id,{ status: 'rejected' })
                } catch (error) {
                  console.error("[TvShowPanel] Error rejecting rename plan:", error)
                }
              },
              onNamingRulesSelected: async (rule) => {
                console.log(`[TvShowPanel] onNamingRulesSelected: ${rule}`)
                try {
                  // Generate new file names based on selected rule

                  // TODO: update plan to loading status
                  const renamePlan = await generateNewFileNames(rule)
                  console.log(`[TvShowPanel] generated rename plan by naming rule ${rule}: `, structuredClone(renamePlan))

                  
                  if (renamePlan) {
                    // Update the temporary plan with the rename data
                    await setPlanById(newPlan.id, {
                      status: 'pending',
                      files: renamePlan.files
                    })
                  } else {
                    await setPlanById(newPlan.id, { status: 'rejected' })
                  }
                } catch (error) {
                  console.error("[TvShowPanel] Error generating file names:", error)
                  await setPlanById(newPlan.id, { status: 'rejected' })
                }
              },
            })
          }}
          selectedMediaMetadata={mediaMetadata}
          openScrape={openScrape}
          episodeTableLayout={episodeTableLayout}
          onEpisodeTableLayoutChange={setEpisodeTableLayout}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {mediaMetadata?.status === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : (
          <TvShowEpisodeTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            onSelectFileContextMenuClick={handleSelectFileContextMenuClick}
            onUnlinkContextMenuClick={handleUnlinkEpisode}
            onEditTagsContextMenuClick={handleEditTagsForRow}
            preview={previewMode}
            previewStatus={previewStatus}
            layout={episodeTableLayout}
            onCheck={(row, checked) => {
              
              setTableData(prev => {
                return prev.map(r => {
                  if(r.type !== 'episode') return r;
                  if(r.season !== row.season || r.episode !== row.episode) return r;
                  return {
                    ...r,
                    checked: checked,
                  }
                })
              })
            }}
          />
        )}
      </div>
    </div>
  )
}

export default TvShowPanel
