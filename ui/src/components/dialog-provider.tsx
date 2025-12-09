import React, { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DialogConfig {
  title?: string
  description?: string
  content?: ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

interface DialogContextValue {
  openDialog: (config: DialogConfig) => void
  closeDialog: () => void
  isOpen: boolean
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined)

interface DialogProviderProps {
  children: ReactNode
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<DialogConfig | null>(null)

  const openDialog = useCallback((dialogConfig: DialogConfig) => {
    setConfig(dialogConfig)
    setIsOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setIsOpen(false)
    if (config?.onClose) {
      config.onClose()
    }
    // Clear config after a brief delay to allow animations to complete
    setTimeout(() => {
      setConfig(null)
    }, 200)
  }, [config])

  const value: DialogContextValue = {
    openDialog,
    closeDialog,
    isOpen,
  }

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          className={config?.className}
          showCloseButton={config?.showCloseButton}
        >
          {config?.title && (
            <DialogHeader>
              <DialogTitle>{config.title}</DialogTitle>
              {config.description && (
                <DialogDescription>{config.description}</DialogDescription>
              )}
            </DialogHeader>
          )}
          {config?.content}
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  )
}

export function useDialogs(): DialogContextValue {
  const context = useContext(DialogContext)
  if (context === undefined) {
    throw new Error("useDialogs must be used within a DialogProvider")
  }
  return context
}

