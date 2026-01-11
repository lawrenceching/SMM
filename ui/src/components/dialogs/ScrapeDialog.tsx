import { useMemo, useState, useEffect } from "react"
import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ScrapeDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"
import { useHandleScrapeStart } from "@/hooks/useHandleScrapeStart"
import { useHandlePosterDownload } from "@/hooks/useHandlePosterDownload"
import { useHandleFanartDownload } from "@/hooks/useHandleFanartDownload"
import { useHandleThumbnailDownload } from "@/hooks/useHandleThumbnailDownload"
import { listFilesApi } from "@/api/listFiles"
import { Path } from "@core/path"
import { basename, extname } from "@/lib/path"
import type { MediaMetadata } from "@core/types"

// Image file extensions that can be used for posters and thumbnails
const imageFileExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg']

interface Task {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  execute: () => Promise<void>;
}

function TaskItem({ task }: { task: Task }) {
  const { t } = useTranslation('dialogs')
  
  const getStatusIcon = () => {
    switch (task.status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "pending":
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (task.status) {
      case "running":
        return t('scrape.status.running')
      case "completed":
        return t('scrape.status.completed')
      case "failed":
        return t('scrape.status.failed')
      case "pending":
      default:
        return t('scrape.status.pending')
    }
  }

  return (
    <div className="flex items-center gap-3 py-2">
      {getStatusIcon()}
      <div className="flex-1">
        <span className="text-sm font-medium">{task.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          ({getStatusText()})
        </span>
      </div>
    </div>
  )
}

function areAllTasksDone(tasks: Task[]): boolean {
  return tasks.every((task) => {
    return task.status === "completed" || task.status === "failed"
  })
}

async function checkTaskCompletion(mediaMetadata: MediaMetadata): Promise<{
  poster: boolean
  fanart: boolean
  thumbnails: boolean
  nfo: boolean
}> {
  const defaultCompletion = {
    poster: false,
    fanart: false,
    thumbnails: false,
    nfo: false,
  }

  // Validate media folder path exists
  if (!mediaMetadata?.mediaFolderPath) {
    console.error('[checkTaskCompletion] mediaFolderPath is undefined')
    return defaultCompletion
  }

  try {
    // Get all files in the media folder
    const response = await listFilesApi(Path.toPlatformPath(mediaMetadata.mediaFolderPath), {
      onlyFiles: true,
    })

    if (!response.data?.items) {
      console.error('[checkTaskCompletion] Failed to get files from listFilesApi')
      return defaultCompletion
    }

    const files = response.data.items

    // Check for poster file
    // Poster files are named "poster.{extension}" where extension is an image extension
    const posterCompleted = files.some((file) => {
      const fileName = basename(file)
      if (!fileName) return false
      return (
        fileName.startsWith('poster.') &&
        imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
      )
    })

    // Check for fanart file
    // Fanart files are named "fanart.{extension}" where extension is an image extension
    const fanartCompleted = files.some((file) => {
      const fileName = basename(file)
      if (!fileName) return false
      return (
        fileName.startsWith('fanart.') &&
        imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
      )
    })

    // Check for NFO file
    // NFO file is named "tvshow.nfo"
    const nfoCompleted = files.some((file) => {
      const fileName = basename(file)
      return fileName === 'tvshow.nfo'
    })

    // Check for thumbnails
    // Thumbnails are named based on the video file name: "{videoFileNameWithoutExt}.{imageExtension}"
    let thumbnailsCompleted = true

    // If there are no media files, thumbnails are considered complete (nothing to download)
    if (!mediaMetadata.mediaFiles || mediaMetadata.mediaFiles.length === 0) {
      thumbnailsCompleted = true
    } else {
      // Check each media file that has season and episode numbers
      for (const mediaFile of mediaMetadata.mediaFiles) {
        // Skip files without season/episode numbers
        if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) {
          continue
        }

        // Get the video file's base name (without extension)
        const videoFileName = basename(mediaFile.absolutePath)
        if (!videoFileName) {
          thumbnailsCompleted = false
          break
        }

        const videoFileExt = extname(videoFileName)
        const videoFileNameWithoutExt = videoFileName.replace(videoFileExt, '')

        // Check if a thumbnail file exists with the same base name but with an image extension
        const hasThumbnail = files.some((file) => {
          const fileName = basename(file)
          if (!fileName) return false

          // Check if file starts with video base name and ends with an image extension
          return (
            fileName.startsWith(videoFileNameWithoutExt + '.') &&
            imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
          )
        })

        if (!hasThumbnail) {
          thumbnailsCompleted = false
          break
        }
      }
    }

    return {
      poster: posterCompleted,
      fanart: fanartCompleted,
      thumbnails: thumbnailsCompleted,
      nfo: nfoCompleted,
    }
  } catch (error) {
    console.error('[checkTaskCompletion] Error checking task completion:', error)
    // If there's an error, assume tasks are not completed
    return defaultCompletion
  }
}

export function ScrapeDialog({
  isOpen,
  onClose,
  mediaMetadata,
}: ScrapeDialogProps) {
  const { t } = useTranslation(['dialogs', 'common'])
  const defaultTitle = t('scrape.defaultTitle')
  const defaultDescription = t('scrape.defaultDescription')
  const handleScrapeStart = useHandleScrapeStart()
  const handlePosterDownload = useHandlePosterDownload()
  const handleFanartDownload = useHandleFanartDownload()
  const handleThumbnailDownload = useHandleThumbnailDownload()

  const [tasks, setTasks] = useState<Task[]>([])

  // Initialize tasks when dialog opens or mediaMetadata changes
  useEffect(() => {
    if (isOpen && mediaMetadata) {
      const initializeTasks = async () => {
        // Check if tasks are already completed by checking for existing files
        const completion = await checkTaskCompletion(mediaMetadata)

        setTasks([
          {
            name: t('scrape.tasks.poster', { ns: 'dialogs' }),
            status: completion.poster ? "completed" : "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handlePosterDownload(mediaMetadata)
            }
          },
          {
            name: t('scrape.tasks.fanart', { ns: 'dialogs' }),
            status: completion.fanart ? "completed" : "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handleFanartDownload(mediaMetadata)
            }
          },
          {
            name: t('scrape.tasks.thumbnails', { ns: 'dialogs' }),
            status: completion.thumbnails ? "completed" : "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handleThumbnailDownload(mediaMetadata)
            }
          },
          {
            name: t('scrape.tasks.nfo', { ns: 'dialogs' }),
            status: completion.nfo ? "completed" : "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handleScrapeStart(mediaMetadata)
            }
          },
        ])
      }

      initializeTasks().catch((error) => {
        console.error('[ScrapeDialog] Error initializing tasks:', error)
        // Fallback to pending status if initialization fails
        setTasks([
          {
            name: t('scrape.tasks.poster', { ns: 'dialogs' }),
            status: "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handlePosterDownload(mediaMetadata)
            }
          },
          {
            name: t('scrape.tasks.fanart', { ns: 'dialogs' }),
            status: "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handleFanartDownload(mediaMetadata)
            }
          },
          {
            name: t('scrape.tasks.thumbnails', { ns: 'dialogs' }),
            status: "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handleThumbnailDownload(mediaMetadata)
            }
          },
          {
            name: t('scrape.tasks.nfo', { ns: 'dialogs' }),
            status: "pending",
            execute: async () => {
              if (!mediaMetadata) {
                console.error('[ScrapeDialog] mediaMetadata is undefined')
                throw new Error('mediaMetadata is undefined')
              }
              await handleScrapeStart(mediaMetadata)
            }
          },
        ])
      })
    }
  }, [isOpen, mediaMetadata, t, handleScrapeStart, handlePosterDownload, handleFanartDownload, handleThumbnailDownload])

  const allTasksDone = useMemo(() => areAllTasksDone(tasks), [tasks])
  const canClose = allTasksDone
  const showButtons = mediaMetadata !== undefined

  const handleClose = () => {
    onClose()
  }

  const handleStart = async () => {
    if (allTasksDone) {
      // If all tasks are done, just close the dialog
      onClose()
    } else if (mediaMetadata) {
      // Execute tasks sequentially
      const currentTasks = [...tasks]
      for (let i = 0; i < currentTasks.length; i++) {
        // Skip tasks that are already completed or failed
        if (currentTasks[i].status === "completed" || currentTasks[i].status === "failed") {
          continue
        }

        // Update task status to running
        setTasks(prevTasks => {
          const updated = [...prevTasks]
          updated[i] = { ...updated[i], status: "running" }
          return updated
        })

        try {
          // Execute the task using the original execute function
          await currentTasks[i].execute()
          
          // Update task status to completed
          setTasks(prevTasks => {
            const updated = [...prevTasks]
            updated[i] = { ...updated[i], status: "completed" }
            return updated
          })
        } catch (error) {
          // Update task status to failed
          setTasks(prevTasks => {
            const updated = [...prevTasks]
            updated[i] = { ...updated[i], status: "failed" }
            return updated
          })
          console.error(`Task "${currentTasks[i].name}" failed:`, error)
          // Error toast is shown by the hook/API layer with more specific error messages
        }
      }
    }
  }

  return (
      <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canClose) {
          handleClose()
        }
      }}
    >
      <DialogContent
        showCloseButton={canClose}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] w-full">
          <div className="space-y-1 py-4">
            {tasks.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                {t('scrape.noTasks')}
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskItem key={index} task={task} />
              ))
            )}
          </div>
        </ScrollArea>
        {showButtons && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button onClick={handleStart} disabled={allTasksDone}>
              {allTasksDone ? (t as any)('scrape.done') : t('scrape.start')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
