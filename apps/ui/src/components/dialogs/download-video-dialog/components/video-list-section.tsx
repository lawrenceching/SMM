import { ScrollArea } from "@/components/ui/scroll-area"
import { ListItem } from "@/components/dialogs/download-video-list-item"

export interface VideoListEntry {
  title: string
  artist: string
  url: string
}

export interface VideoListSectionProps {
  entries: VideoListEntry[]
  selectedUrls: Set<string>
  onToggleUrl: (url: string) => void
  formBusy: boolean
  t: (key: string) => string
}

export function VideoListSection({
  entries,
  selectedUrls,
  onToggleUrl,
  formBusy,
}: VideoListSectionProps) {
  if (entries.length === 0) return null

  return (
    <div
      data-testid="download-video-dialog-video-list"
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
    >
      <ScrollArea className="h-52">
        <ul
          data-testid="download-video-dialog-episodes-list"
          className="list-none space-y-2 p-0 m-0 pr-3"
        >
          {entries.map((entry) => {
            const { title, url: vidUrl } = entry
            return (
              <ListItem
                key={vidUrl}
                listItemTestId="download-video-dialog-episodes-list-item"
                checkboxTestId={`download-video-dialog-episode-checkbox-${vidUrl}`}
                label={title}
                checked={selectedUrls.has(vidUrl)}
                onToggle={() => onToggleUrl(vidUrl)}
                disabled={formBusy}
              />
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
