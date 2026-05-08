import { useTranslation } from "react-i18next"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"

export function FolderNotAvailablePanel() {
  const { t } = useTranslation("components", { keyPrefix: "folderNotAvailablePanel" })
  const { selectedFolder } = useUIMediaFolderStoreState()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-auto p-6 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {selectedFolder ? (
          <p className="text-muted-foreground mt-4 break-all font-mono text-xs">{selectedFolder}</p>
        ) : null}
      </div>
    </div>
  )
}
