import { useEffect, useState } from "react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { ImageViewer } from "@/components/ImageViewer"
import { useTranslation } from "@/lib/i18n"
import {
  FileText,
  Calendar,
  Clock,
  HardDrive,
  Image,
  Video,
  Loader2,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { extensions } from "@core/utils"
import { getMediaTags, writeMediaTags, generateFfmpegScreenshots } from "@/api/ffmpeg"
import { Path } from "@core/path"
import { useDialogs } from "@/providers/dialog-provider"
import { toast } from "sonner"

export interface TrackProperties {
  id: number
  title?: string
  artist?: string
  duration?: number
  thumbnail?: string
  addedDate?: Date
  filePath?: string
  path?: string
}

export interface MediaFilePropertyDialogProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  track?: TrackProperties
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

type FileType = "image" | "video" | "unknown"

function getFileExtension(filePath: string): string {
  const parts = filePath.split(".")
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

function getFileType(filePath: string): FileType {
  if (!filePath) return "unknown"
  const ext = "." + getFileExtension(filePath)
  if (extensions.imageFileExtensions.includes(ext)) return "image"
  if (extensions.videoFileExtensions.includes(ext)) return "video"
  return "unknown"
}

/** Preview row for images / video screenshots. */
function PreviewRow({
  fileType,
  screenshots,
  isLoading: loading,
  onPreviewClick,
}: {
  fileType: FileType
  screenshots?: string[]
  isLoading?: boolean
  onPreviewClick?: (url: string) => void
}) {
  const { t } = useTranslation(["dialogs", "common"])
  const mockImagePreview = "https://picsum.photos/seed/mock/400/300"

  if (fileType === "unknown") return null
  const isImage = fileType === "image"
  const canClick = !!onPreviewClick

  const handleKeyDown = (e: React.KeyboardEvent, url: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onPreviewClick?.(url)
    }
  }

  return (
    <TableRow>
      <TableCell className="w-[140px] py-3 font-medium text-muted-foreground align-top">
        <div className="flex items-center gap-2">
          {isImage ? (
            <Image className="size-4 shrink-0" />
          ) : (
            <Video className="size-4 shrink-0" />
          )}
          <span>{t("fileProperty.preview")}</span>
        </div>
      </TableCell>
      <TableCell className="py-3" colSpan={2}>
        {loading ? (
          <div className="flex items-center justify-center aspect-video w-full rounded-md bg-muted">
            <Loader2 className="size-8 text-muted-foreground animate-spin" />
          </div>
        ) : isImage ? (
          <div
            className={cn(
              "w-full rounded-md overflow-hidden bg-muted",
              canClick && "cursor-pointer",
            )}
          >
            <button
              type="button"
              onClick={() => onPreviewClick?.(mockImagePreview)}
              onKeyDown={(e) => handleKeyDown(e, mockImagePreview)}
              className="w-full h-auto block text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
              aria-label={t("fileProperty.viewFullSize", "View full size")}
            >
              <img
                src={mockImagePreview}
                alt=""
                className="w-full h-auto object-contain max-h-64 pointer-events-none"
              />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1">
            {screenshots && screenshots.length > 0 ? (
              screenshots.map((screenshot, index) => {
                const screenshotUrl = `/api/image?url=${encodeURIComponent("file://" + screenshot)}`
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onPreviewClick?.(screenshotUrl)}
                    onKeyDown={(e) => handleKeyDown(e, screenshotUrl)}
                    className={cn(
                      "min-w-0 rounded overflow-hidden bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      canClick && "cursor-pointer",
                    )}
                    aria-label={t("fileProperty.viewFullSize", "View full size")}
                  >
                    <img
                      src={screenshotUrl}
                      alt=""
                      className="w-full h-auto block object-contain pointer-events-none"
                    />
                  </button>
                )
              })
            ) : (
              <div className="col-span-5 aspect-video w-full bg-muted flex items-center justify-center rounded">
                <Video className="size-12 text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

/** Desktop-style read-only property row with icon + label + value. */
function ReadonlyRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <TableRow>
      <TableCell className="w-[140px] py-2.5 font-medium text-muted-foreground align-top">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-foreground whitespace-normal break-words" colSpan={2}>
        <span className="block">{value || "-"}</span>
      </TableCell>
    </TableRow>
  )
}

/** Editable tag row with label + input. */
function EditableRow({
  label,
  value,
  onChange,
  dataTestId,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  dataTestId?: string
}) {
  return (
    <TableRow>
      <TableCell className="w-[140px] py-2 font-medium text-muted-foreground whitespace-normal">
        {label}
      </TableCell>
      <TableCell className="py-2 pr-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
          data-testid={dataTestId}
        />
      </TableCell>
      <TableCell className="py-2" />
    </TableRow>
  )
}

export function MediaFilePropertyDialog({
  isOpen,
  onClose,
  filePath,
  track,
}: MediaFilePropertyDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])

  // ── Tags state (editable) ────────────────────────────────────────
  const [tags, setTags] = useState<Record<string, string>>({
    title: "",
    artist: "",
    comment: "",
    date: "",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Screenshots state (for video preview) ────────────────────────
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false)
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null)

  const resolvedFilePath = filePath || track?.filePath || track?.path || ""
  const fileType = getFileType(resolvedFilePath)

  // ── Load data on open ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setScreenshots([])
    setViewerImageUrl(null)

    // Load tags
    if (resolvedFilePath) {
      getMediaTags({ path: resolvedFilePath })
        .then((res) => {
          if (res.error) {
            console.warn("[MediaFilePropertyDialog] Failed to load tags:", res.error)
            return
          }
          setTags({
            title: res.tags?.title ?? res.tags?.TITLE ?? track?.title ?? "",
            artist: res.tags?.artist ?? res.tags?.ARTIST ?? track?.artist ?? "",
            comment: res.tags?.comment ?? res.tags?.COMMENT ?? "",
            date: res.tags?.date ?? res.tags?.DATE ?? "",
          })
        })
        .catch((err) => {
          console.warn("[MediaFilePropertyDialog] Error loading tags:", err)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }

    // Load screenshots for videos
    if (fileType === "video") {
      setIsLoadingScreenshots(true)
      generateFfmpegScreenshots(Path.posix(resolvedFilePath))
        .then((res) => {
          if (res.screenshots) setScreenshots(res.screenshots)
        })
        .catch((err) => {
          console.warn("[MediaFilePropertyDialog] Failed to generate screenshots:", err)
        })
        .finally(() => setIsLoadingScreenshots(false))
    }
  }, [isOpen, resolvedFilePath, fileType, track]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save handler ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!resolvedFilePath) return
    setSaving(true)
    try {
      const res = await writeMediaTags({
        path: resolvedFilePath,
        tags: {
          title: tags.title,
          artist: tags.artist,
          comment: tags.comment,
          date: tags.date,
        },
      })
      if (res.error) {
        toast.error(t("editMediaFile.saveFailed"), { description: res.error })
        return
      }
      toast.success(t("editMediaFile.saveSuccess"))
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(t("editMediaFile.saveFailed"), { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => onClose()

  // ── Derived values ───────────────────────────────────────────────
  const estimatedFileSize = (track?.duration ?? 0) * 128000

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <ScrollableDialogContent
          showCloseButton
          className="max-w-3xl sm:max-w-3xl max-h-[85vh]"
          data-testid="media-file-property-dialog"
        >
          <ScrollableDialogHeader className="min-w-0">
            <DialogTitle className="text-lg line-clamp-2 min-w-0 wrap-break-word">
              {t("mediaFileProperty.title")}
            </DialogTitle>
            <DialogDescription className="truncate min-w-0">
              {resolvedFilePath ? resolvedFilePath.split("/").pop()?.split("\\").pop() : ""}
            </DialogDescription>
          </ScrollableDialogHeader>

          <ScrollableDialogBody className="min-w-0 py-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span>{t("loading", { ns: "common" })}</span>
              </div>
            ) : (
              <Table className="table-fixed">
                <TableBody>
                  {/* ── Read-only properties section ── */}
                  {track?.title && (
                    <ReadonlyRow
                      icon={FileText}
                      label={t("fileProperty.title")}
                      value={track.title}
                    />
                  )}
                  {track?.artist && (
                    <ReadonlyRow
                      icon={FileText}
                      label={t("fileProperty.artist")}
                      value={track.artist}
                    />
                  )}
                  {track?.duration != null && (
                    <ReadonlyRow
                      icon={Clock}
                      label={t("fileProperty.duration")}
                      value={formatDuration(track.duration)}
                    />
                  )}
                  <ReadonlyRow
                    icon={HardDrive}
                    label={t("fileProperty.estimatedSize")}
                    value={formatFileSize(estimatedFileSize)}
                  />
                  {track?.addedDate && (
                    <ReadonlyRow
                      icon={Calendar}
                      label={t("fileProperty.addedDate")}
                      value={formatDate(track.addedDate)}
                    />
                  )}

                  {/* ── Preview ── */}
                  <PreviewRow
                    fileType={fileType}
                    screenshots={screenshots}
                    isLoading={isLoadingScreenshots}
                    onPreviewClick={(url) => setViewerImageUrl(url)}
                  />

                  {/* ── Divider ── */}
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="border-t border-border pt-4 pb-1"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("mediaFileProperty.editableTags", "Editable Tags")}
                      </span>
                    </TableCell>
                  </TableRow>

                  {/* ── Editable tags section ── */}
                  <EditableRow
                    label={t("editMediaFile.fields.title")}
                    value={tags.title}
                    onChange={(v) => setTags((prev) => ({ ...prev, title: v }))}
                    dataTestId="media-file-property-title"
                  />
                  <EditableRow
                    label={t("editMediaFile.fields.artist")}
                    value={tags.artist}
                    onChange={(v) => setTags((prev) => ({ ...prev, artist: v }))}
                    dataTestId="media-file-property-artist"
                  />
                  <EditableRow
                    label={t("editMediaFile.fields.comment")}
                    value={tags.comment}
                    onChange={(v) => setTags((prev) => ({ ...prev, comment: v }))}
                    dataTestId="media-file-property-comment"
                  />
                  <EditableRow
                    label={t("editMediaFile.fields.date")}
                    value={tags.date}
                    onChange={(v) => setTags((prev) => ({ ...prev, date: v }))}
                    dataTestId="media-file-property-date"
                  />
                </TableBody>
              </Table>
            )}
          </ScrollableDialogBody>

          <ScrollableDialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              data-testid="media-file-property-cancel"
            >
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || saving}
              data-testid="media-file-property-save"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {t("editMediaFile.saving")}
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  {t("editMediaFile.save")}
                </>
              )}
            </Button>
          </ScrollableDialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      <ImageViewer
        imageUrl={viewerImageUrl}
        onClose={() => setViewerImageUrl(null)}
        dismissOnClick
        title={t("fileProperty.imagePreview", "Image preview")}
      />
    </>
  )
}
