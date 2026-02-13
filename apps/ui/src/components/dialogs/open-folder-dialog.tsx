import { FolderOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useConfig } from "@/providers/config-provider"
import { useTranslation } from "@/lib/i18n"
import type { OpenFolderDialogProps, FolderType } from "./types"

export function OpenFolderDialog({ isOpen, onClose, onSelect, folderPath }: OpenFolderDialogProps) {
  const { t } = useTranslation('dialogs')
  const { userConfig } = useConfig()

  const handleSelect = (type: FolderType) => {
    console.log(`[DialogProvider] handleSelect ${type} ${folderPath}`)

    if(!folderPath) {
      console.error("Folder path is required")
      onClose()
      return;
    }

    if(userConfig === undefined) {
      console.error("User config is required")
      onClose()
      return
    }

    onSelect(type)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>{t('openFolder.title')}</DialogTitle>
          <DialogDescription>
            {t('openFolder.description')}
          </DialogDescription>
        </DialogHeader>
        {folderPath && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted border min-w-0 overflow-hidden">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <span className="text-xs font-medium text-muted-foreground">{t('openFolder.folderPathLabel')}</span>
              <span className="text-sm truncate">{folderPath}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("tvshow")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">{t('openFolder.types.tvshow.label')}</span>
              <span className="text-xs text-muted-foreground">{t('openFolder.types.tvshow.description')}</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("movie")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">{t('openFolder.types.movie.label')}</span>
              <span className="text-xs text-muted-foreground">{t('openFolder.types.movie.description')}</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("music")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">{t('openFolder.types.music.label')}</span>
              <span className="text-xs text-muted-foreground">{t('openFolder.types.music.description')}</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

