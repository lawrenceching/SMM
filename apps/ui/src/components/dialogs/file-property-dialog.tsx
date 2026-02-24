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
  title?: string
  artist?: string
  duration?: number
  thumbnail?: string
  addedDate?: Date
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

export function FilePropertyDialog({ isOpen, onClose, track }: FilePropertyDialogProps) {
  if (!track) {
    return null
  }

  const { t } = useTranslation(['dialogs', 'common'])

  const estimatedFileSize = (track.duration ?? 0) * 128000

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
        className="max-w-lg overflow-hidden"
        data-testid="file-property-dialog"
      >
        <DialogHeader className="min-w-0">
          <DialogTitle className="text-xl line-clamp-2 min-w-0 wrap-break-word">{track.title ?? ''}</DialogTitle>
          <DialogDescription className="truncate min-w-0">{track.artist ?? ''}</DialogDescription>
        </DialogHeader>

        <div className="py-4 min-w-0 overflow-hidden" role="list" aria-label="File properties">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
