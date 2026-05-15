import { useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
} from "@/components/ui/scrollable-dialog"
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
      <ScrollableDialogContent
        className="max-w-3xl overflow-hidden"
        showCloseButton={true}
      >
        <ScrollableDialogBody className="min-h-0">
        <MediaSearch onSelect={(id) => setSelectedTmdbId(id)} />
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTmdbId}>
            Confirm
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}

