import { Button } from "@/components/ui/button"

export interface DeleteTrackDialogProps {
  trackTitle: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteTrackDialog({ trackTitle, onConfirm, onCancel }: DeleteTrackDialogProps) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={onConfirm}>
        Delete
      </Button>
    </div>
  )
}
