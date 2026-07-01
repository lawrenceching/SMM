import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"

export function ErrorLoadingPanel() {
  const { selectedFolder } = useUIMediaFolderStoreState()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-auto p-6 text-center">
      <div className="max-w-md space-y-3">
        <h2 className="text-lg font-semibold text-destructive">Failed to load media folder</h2>
        <p className="text-muted-foreground text-sm">
          The media folder type could not be determined. This may indicate a problem with the metadata cache.
        </p>
        {selectedFolder ? (
          <div className="mt-4 space-y-2">
            <p className="text-muted-foreground break-all font-mono text-xs">{selectedFolder}</p>
            <p className="text-muted-foreground text-xs">
              Try removing and re-importing this folder.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
