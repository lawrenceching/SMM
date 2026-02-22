import { Button } from "@/components/ui/button"

export interface DeleteTrackDialogProps {
  trackTitle: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteTrackDialog({ trackTitle, onConfirm, onCancel }: DeleteTrackDialogProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to delete "{trackTitle}"? This action cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </div>
  )
}
