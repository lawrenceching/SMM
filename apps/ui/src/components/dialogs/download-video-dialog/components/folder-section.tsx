import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface FolderSectionProps {
  downloadFolder: string
  formBusy: boolean
  disabled: boolean
  onFolderChange: (value: string) => void
  onFolderSelect: () => void
  t: (key: string) => string
}

export function FolderSection({
  downloadFolder,
  formBusy,
  disabled,
  onFolderChange,
  onFolderSelect,
  t,
}: FolderSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="downloadFolder">{t("downloadVideo.folderLabel")}</Label>
      <div className="flex gap-2">
        <Input
          data-testid="download-video-dialog-folder-input"
          id="downloadFolder"
          type="text"
          placeholder={t("downloadVideo.folderPlaceholder")}
          value={downloadFolder}
          onChange={(e) => onFolderChange(e.target.value)}
          disabled={formBusy || disabled}
          readOnly
        />
        <Button
          data-testid="download-video-dialog-folder-picker"
          type="button"
          variant="outline"
          onClick={onFolderSelect}
          disabled={formBusy || disabled}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
