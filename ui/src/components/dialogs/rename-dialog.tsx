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
import { Label } from "@/components/ui/label"
import type { RenameDialogProps } from "./types"

export function RenameDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  initialValue = "", 
  title = "Rename", 
  description = "Enter the new name",
  suggestions = []
}: RenameDialogProps) {
  const [newName, setNewName] = useState(initialValue)

  // Reset to initial value when dialog opens or initialValue changes
  useEffect(() => {
    if (isOpen) {
      setNewName(initialValue)
    }
  }, [isOpen, initialValue])

  const handleConfirm = () => {
    if (newName.trim()) {
      onConfirm(newName.trim())
      onClose()
    }
  }

  const handleCancel = () => {
    setNewName(initialValue)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirm()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setNewName(suggestion)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent showCloseButton={true} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="newName">New Name</Label>
            <Input
              id="newName"
              type="text"
              placeholder="Enter new name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          {suggestions && suggestions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Suggestions</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-left px-2 py-1 rounded text-xs border bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!newName.trim() || newName.trim() === (initialValue || "").trim()}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

