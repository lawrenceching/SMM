import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ListItem } from "@/components/dialogs/download-video-list-item"

export interface CollectionSectionProps {
  isCollectionUrl: boolean
  downloadCollectionVideos: boolean
  collectionEntries: { url: string }[]
  collectionMetadataLoading: boolean
  collectionError: string | null
  selectedCollectionUrls: Set<string>
  formBusy: boolean
  hasAgreed: boolean
  onDownloadCollectionVideosChange: (checked: boolean) => void
  onToggleCollectionUrl: (url: string) => void
  t: (key: string) => string
}

export function CollectionSection({
  isCollectionUrl,
  downloadCollectionVideos,
  collectionEntries,
  collectionMetadataLoading,
  collectionError,
  selectedCollectionUrls,
  formBusy,
  hasAgreed,
  onDownloadCollectionVideosChange,
  onToggleCollectionUrl,
  t,
}: CollectionSectionProps) {
  if (!isCollectionUrl) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id="download-video-get-videos"
          data-testid="download-video-dialog-get-videos-checkbox"
          checked={downloadCollectionVideos}
          onCheckedChange={(checked) =>
            onDownloadCollectionVideosChange(checked === true)
          }
          disabled={formBusy || !hasAgreed}
        />
        <Label htmlFor="download-video-get-videos" className="cursor-pointer font-normal">
          {t("downloadVideo.getVideos")}
        </Label>
      </div>
      {downloadCollectionVideos && isCollectionUrl && hasAgreed && (
        <div
          data-testid="download-video-dialog-collection-panel"
          className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
        >
          {collectionMetadataLoading && (
            <p className="text-sm text-muted-foreground">
              {t("downloadVideo.collectionVideosLoading")}
            </p>
          )}
          {collectionError && !collectionMetadataLoading && (
            <p className="text-sm text-destructive">{collectionError}</p>
          )}
          {!collectionMetadataLoading &&
            !collectionError &&
            collectionEntries.length > 0 && (
              <ScrollArea className="h-52">
                <ul
                  data-testid="download-video-dialog-collection-list"
                  className="list-none space-y-2 p-0 m-0 pr-3"
                >
                  {collectionEntries.map((entry) => {
                    const vidUrl = entry.url
                    return (
                      <ListItem
                        key={vidUrl}
                        listItemTestId="download-video-dialog-collection-list-item"
                        checkboxTestId={`download-video-dialog-collection-checkbox-${vidUrl}`}
                        label={vidUrl}
                        labelClassName="break-all leading-snug"
                        fetchVideoMetadata
                        videoUrl={vidUrl}
                        checked={selectedCollectionUrls.has(vidUrl)}
                        onToggle={() => onToggleCollectionUrl(vidUrl)}
                        disabled={formBusy}
                      />
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
        </div>
      )}
    </>
  )
}
