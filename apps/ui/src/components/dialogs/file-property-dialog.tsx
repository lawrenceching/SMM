import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"
import { FileText, Calendar, Clock, HardDrive, Music } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TrackProperties {
  id: number
  title: string
  artist: string
  album: string
  duration: number
  genre: string
  thumbnail: string
  addedDate: Date
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
      <div className="flex-shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center">
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

export function FilePropertyDialog({ isOpen, onClose, track }: FilePropertyDialogProps) {
  if (!track) {
    return null
  }

  const { t } = useTranslation(['dialogs', 'common'])

  const estimatedFileSize = track.duration * 128000

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={true} 
        className="max-w-lg"
        data-testid="file-property-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              <img
                src={track.thumbnail}
                alt={`${track.album} cover`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{track.title}</DialogTitle>
              <DialogDescription>{track.artist}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4" role="list" aria-label="File properties">
          <PropertyRow
            icon={Music}
            label={t('fileProperty.title')}
            value={track.title}
          />
          <PropertyRow
            icon={FileText}
            label={t('fileProperty.artist')}
            value={track.artist}
          />
          <PropertyRow
            icon={HardDrive}
            label={t('fileProperty.album')}
            value={track.album}
          />
          <PropertyRow
            icon={Music}
            label={t('fileProperty.genre')}
            value={track.genre}
          />
          <PropertyRow
            icon={Clock}
            label={t('fileProperty.duration')}
            value={formatDuration(track.duration)}
          />
          <PropertyRow
            icon={HardDrive}
            label={t('fileProperty.estimatedSize')}
            value={formatFileSize(estimatedFileSize)}
          />
          <PropertyRow
            icon={Calendar}
            label={t('fileProperty.addedDate')}
            value={formatDate(track.addedDate)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
