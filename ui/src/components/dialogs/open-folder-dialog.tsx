import { FolderOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useConfig } from "@/components/config-provider"
import { useMediaMetadata } from "@/components/media-metadata-provider"
import { Path } from "@core/path"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import type { OpenFolderDialogProps, FolderType } from "./types"

export function OpenFolderDialog({ isOpen, onClose, onSelect, folderPath }: OpenFolderDialogProps) {
  const { userConfig, setUserConfig } = useConfig()
  const { addMediaMetadata } = useMediaMetadata()

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

    setUserConfig({
      ...userConfig,
      folders: [...userConfig.folders, folderPath]
    })

    readMediaMetadataApi(folderPath).then((data) => {
      if(!!data.data) {
        console.log(`[OpenFolderDialog] Media metadata is already exists, skip adding new metadata`)
      } else {
        addMediaMetadata({
          mediaFolderPath: Path.posix(folderPath),
          type: type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder",
        })
      }
    })
    .catch((error) => {
      console.error("Failed to read media metadata:", error)
    })

    onSelect(type)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Select Folder Type</DialogTitle>
          <DialogDescription>
            Choose the type of media folder you want to open
          </DialogDescription>
        </DialogHeader>
        {folderPath && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Folder Path</span>
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
              <span className="font-semibold">Tv Show / Anime</span>
              <span className="text-xs text-muted-foreground">For television series and anime</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("movie")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">Movie</span>
              <span className="text-xs text-muted-foreground">For movies and films</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("music")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">Music</span>
              <span className="text-xs text-muted-foreground">For music albums and tracks</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

