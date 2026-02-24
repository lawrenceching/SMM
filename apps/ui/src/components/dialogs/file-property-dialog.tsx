import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"
import { FileText, Calendar, Clock, HardDrive, Music, Image, Video, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { extensions } from "@core/utils"
import { generateFfmpegScreenshots } from "@/api/ffmpeg"
import { Path } from "@core/path"

export interface TrackProperties {
  id: number
  title?: string
  artist?: string
  duration?: number
  thumbnail?: string
  addedDate?: Date
  filePath?: string
  path?: string
}

export interface FilePropertyDialogProps {
  isOpen: boolean
  onClose: () => void
  track?: TrackProperties
}

function PropertyRow({
  icon: IconComponent,
  label,
  value,
  className
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-3 py-2 border-b border-border/50 last:border-0", className)}>
      <div className="shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center">
        <IconComponent className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

type FileType = 'image' | 'video' | 'unknown'

function getFileExtension(filePath: string): string {
  const parts = filePath.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function getFileType(filePath: string): FileType {
  if (!filePath) return 'unknown'
  
  const ext = '.' + getFileExtension(filePath)
  
  if (extensions.imageFileExtensions.includes(ext)) {
    return 'image'
  }
  
  if (extensions.videoFileExtensions.includes(ext)) {
    return 'video'
  }
  
  return 'unknown'
}

function PreviewRow({
  fileType,
  screenshots,
  isLoading,
  className
}: {
  fileType: FileType
  screenshots?: string[]
  isLoading?: boolean
  className?: string
}) {
  const { t } = useTranslation(['dialogs', 'common'])
  
  const mockImagePreview = "https://picsum.photos/seed/mock/400/300"
  
  if (fileType === 'unknown') {
    return null
  }
  
  const isImage = fileType === 'image'
  
  return (
    <div className={cn("py-2 border-b border-border/50 last:border-0", className)}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center">
          {isImage ? (
            <Image className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Video className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-2">{t('fileProperty.preview')}</p>
          {isLoading ? (
            <div 
              className={cn("w-full rounded-md overflow-hidden bg-muted flex items-center justify-center", isImage ? "aspect-[4/3]" : "aspect-video")}
            >
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          ) : isImage ? (
            <div className="w-full rounded-md overflow-hidden bg-muted">
              <img 
                src={mockImagePreview} 
                alt="Image preview" 
                className="w-full h-auto object-contain max-h-64"
              />
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {screenshots && screenshots.length > 0 ? (
                screenshots.map((screenshot, index) => (
                  <div key={index} className="min-w-0 rounded overflow-hidden bg-muted">
                    <img 
                      src={`/api/image?url=${encodeURIComponent('file://' + screenshot)}`}
                      alt={`Video preview ${index + 1}`}
                      className="w-full h-auto block object-contain"
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-5 aspect-video w-full bg-muted flex items-center justify-center rounded">
                  <Video className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FilePropertyDialog({ isOpen, onClose, track }: FilePropertyDialogProps) {
  const { t } = useTranslation(['dialogs', 'common'])
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !track) {
      setScreenshots([])
      return
    }

    const filePath = track.filePath ?? track.path ?? ''
    const fileType = getFileType(filePath)

    if (fileType === 'video') {
      const loadScreenshots = async () => {
        setIsLoadingScreenshots(true)
        try {
          const posixPath = Path.posix(filePath)
          const result = await generateFfmpegScreenshots(posixPath)
          if (result.screenshots) {
            setScreenshots(result.screenshots)
          }
        } catch (error) {
          console.error('Failed to generate screenshots:', error)
        } finally {
          setIsLoadingScreenshots(false)
        }
      }

      loadScreenshots()
    } else {
      setScreenshots([])
    }
  }, [isOpen, track])

  if (!track) {
    return null
  }

  const estimatedFileSize = (track.duration ?? 0) * 128000
  const filePath = track.filePath ?? track.path ?? ''
  const fileType = getFileType(filePath)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={true} 
        className="max-w-lg max-h-[80vh] flex flex-col"
        data-testid="file-property-dialog"
      >
        <DialogHeader className="min-w-0 shrink-0">
          <DialogTitle className="text-xl line-clamp-2 min-w-0 wrap-break-word">{track.title ?? ''}</DialogTitle>
          <DialogDescription className="truncate min-w-0">{track.artist ?? ''}</DialogDescription>
        </DialogHeader>

        <div className="py-4 min-w-0 min-h-0 flex-1 overflow-y-auto" role="list" aria-label="File properties">
          <PropertyRow
            icon={Music}
            label={t('fileProperty.title')}
            value={track.title ?? ''}
          />
          <PropertyRow
            icon={FileText}
            label={t('fileProperty.artist')}
            value={track.artist ?? ''}
          />
          <PropertyRow
            icon={Clock}
            label={t('fileProperty.duration')}
            value={track.duration ? formatDuration(track.duration) : ''}
          />
          <PropertyRow
            icon={HardDrive}
            label={t('fileProperty.estimatedSize')}
            value={formatFileSize(estimatedFileSize)}
          />
          <PropertyRow
            icon={Calendar}
            label={t('fileProperty.addedDate')}
            value={track.addedDate ? formatDate(track.addedDate) : ''}
          />
          <PreviewRow 
            fileType={fileType} 
            screenshots={screenshots}
            isLoading={isLoadingScreenshots}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
