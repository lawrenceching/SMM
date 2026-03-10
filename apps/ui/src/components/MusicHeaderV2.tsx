import { Download, Music } from "lucide-react"
import { Button } from "./ui/button"
import { useTranslation } from "@/lib/i18n"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

export interface MusicHeaderV2Props {
    selectedMediaMetadata?: UIMediaMetadata
    onDownloadClick?: () => void
}

export function MusicHeaderV2({
    selectedMediaMetadata,
    onDownloadClick,
}: MusicHeaderV2Props) {
    const { t } = useTranslation(['components'])

    const folderName = selectedMediaMetadata?.mediaFolderPath?.split('/').pop() || 'Music'
    const trackCount = selectedMediaMetadata?.files?.length ?? 0

    return (
        <div className="relative w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Music className="size-5 text-muted-foreground" />
                        <h1 className="text-lg font-semibold truncate">{folderName}</h1>
                        <span className="text-sm text-muted-foreground">
                            ({trackCount} {trackCount === 1 ? 'track' : 'tracks'})
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownloadClick?.()}
                        disabled={!selectedMediaMetadata?.mediaFolderPath}
                    >
                        <Download className="size-4 mr-2" />
                        {t('mediaPlayer.download', { defaultValue: 'Download' })}
                    </Button>
                </div>
            </div>
        </div>
    )
}
