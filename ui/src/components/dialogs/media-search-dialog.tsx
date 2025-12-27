import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MediaSearch } from "@/components/MediaSearch"
import type { MediaSearchDialogProps } from "./types"

export function MediaSearchDialog({ isOpen, onClose, onSelect }: MediaSearchDialogProps) {
  const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(null);

  const handleConfirm = () => {
    if (selectedTmdbId && onSelect) {
      onSelect(selectedTmdbId);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl overflow-hidden"
        showCloseButton={true}
      >
        <MediaSearch onSelect={(id) => setSelectedTmdbId(id)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTmdbId}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

