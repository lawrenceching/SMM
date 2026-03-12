import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import type { EditMediaFileDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"
import { getMediaTags, writeMediaTags } from "@/api/ffmpeg"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const TAG_KEYS = ["title", "artist", "comment", "date"] as const
type TagKey = (typeof TAG_KEYS)[number]

function getTagLabels(t: (key: string) => string): Record<TagKey, string> {
  return {
    title: t("editMediaFile.fields.title"),
    artist: t("editMediaFile.fields.artist"),
    comment: t("editMediaFile.fields.comment"),
    date: t("editMediaFile.fields.date"),
  }
}

export function EditMediaFileDialog({
  isOpen,
  onClose,
  path,
}: EditMediaFileDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const [tags, setTags] = useState<Record<TagKey, string>>({
    title: "",
    artist: "",
    comment: "",
    date: "",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !path) return
    setLoading(true)
    getMediaTags({ path })
      .then((res) => {
        if (res.error) {
          toast.error(t("editMediaFile.loadFailed"), { description: res.error })
          return
        }
        const next = { title: "", artist: "", comment: "", date: "" }
        for (const key of TAG_KEYS) {
          next[key] = res.tags?.[key] ?? ""
        }
        setTags(next)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(t("editMediaFile.loadFailed"), { description: msg })
      })
      .finally(() => setLoading(false))
  }, [isOpen, path, t])

  const handleChange = (key: TagKey, value: string) => {
    setTags((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!path) return
    setSaving(true)
    try {
      const res = await writeMediaTags({
        path,
        tags: { title: tags.title, artist: tags.artist, comment: tags.comment, date: tags.date },
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
  const labels = getTagLabels((key) => t(key as 'editMediaFile.fields.title' | 'editMediaFile.fields.artist' | 'editMediaFile.fields.comment' | 'editMediaFile.fields.date'))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent showCloseButton className="max-w-md" data-testid="edit-media-file-dialog">
        <DialogHeader>
          <DialogTitle>{t("editMediaFile.title")}</DialogTitle>
          <DialogDescription>{t("editMediaFile.description")}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>{t("loading", { ns: "common" })}</span>
            </div>
          ) : (
            <Table>
              <TableBody>
                {TAG_KEYS.map((key) => (
                  <TableRow key={key}>
                    <TableCell className="w-[100px] py-2 font-medium align-middle text-muted-foreground">
                      {labels[key]}
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={tags[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder=""
                        className="h-8"
                        data-testid={`edit-media-file-${key}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving} data-testid="edit-media-file-cancel">
            {t("cancel", { ns: "common" })}
          </Button>
          <Button onClick={handleSave} disabled={loading || saving} data-testid="edit-media-file-save">
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                {t("editMediaFile.saving")}
              </>
            ) : (
              t("editMediaFile.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
