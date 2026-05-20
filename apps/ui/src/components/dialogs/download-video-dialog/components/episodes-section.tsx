import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ListItem } from "@/components/dialogs/download-video-list-item"

interface EpisodeItem {
  title: string
  artist: string
  url: string
}

export interface EpisodesSectionProps {
  canDownloadEpisodes: boolean
  downloadEpisodes: boolean
  episodes: EpisodeItem[]
  episodesLoading: boolean
  episodesError: string | null
  selectedEpisodeUrls: Set<string>
  formBusy: boolean
  hasAgreed: boolean
  onDownloadEpisodesChange: (checked: boolean) => void
  onToggleEpisode: (url: string) => void
  t: (key: string) => string
}

export function EpisodesSection({
  canDownloadEpisodes,
  downloadEpisodes,
  episodes,
  episodesLoading,
  episodesError,
  selectedEpisodeUrls,
  formBusy,
  hasAgreed,
  onDownloadEpisodesChange,
  onToggleEpisode,
  t,
}: EpisodesSectionProps) {
  if (!canDownloadEpisodes) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id="download-video-episodes"
          data-testid="download-video-dialog-episodes-checkbox"
          checked={downloadEpisodes}
          onCheckedChange={(checked) => onDownloadEpisodesChange(checked === true)}
          disabled={formBusy || !hasAgreed}
        />
        <Label htmlFor="download-video-episodes" className="cursor-pointer font-normal">
          {t("downloadVideo.downloadEpisodesLabel")}
        </Label>
      </div>
      {downloadEpisodes && hasAgreed && (
        <div
          data-testid="download-video-dialog-episodes-panel"
          className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
        >
          {episodesLoading && (
            <p className="text-sm text-muted-foreground">
              {t("downloadVideo.episodesLoading")}
            </p>
          )}
          {episodesError && !episodesLoading && (
            <p className="text-sm text-destructive">{episodesError}</p>
          )}
          {!episodesLoading && !episodesError && episodes.length > 0 && (
            <ScrollArea className="h-52">
              <ul
                data-testid="download-video-dialog-episodes-list"
                className="list-none space-y-2 p-0 m-0 pr-3"
              >
                {episodes.map((episode) => {
                  const { title, url: vidUrl } = episode
                  return (
                    <ListItem
                      key={vidUrl}
                      listItemTestId="download-video-dialog-episodes-list-item"
                      checkboxTestId={`download-video-dialog-episode-checkbox-${episode.url}`}
                      label={title}
                      checked={selectedEpisodeUrls.has(vidUrl)}
                      onToggle={() => onToggleEpisode(vidUrl)}
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
