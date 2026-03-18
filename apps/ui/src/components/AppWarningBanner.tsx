import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

const LOCAL_STORAGE_KEY = "warning.appNotFullyTestedInMacOsOrLinux"
const MOCK_OS_KEY = "mock.os"

function safeGetLocalStorageItem(key: string): string | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return null
    }
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetLocalStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem(key, value)
    }
  } catch {
  }
}

function getOS(): "macos" | "linux" | "win" | "unknown" {
  if (typeof window === "undefined") {
    return "unknown"
  }

  const mockOS = safeGetLocalStorageItem(MOCK_OS_KEY)
  if (mockOS === "macos" || mockOS === "linux" || mockOS === "win") {
    return mockOS
  }

  try {
    const platform = navigator?.platform?.toLowerCase() || ""
    if (platform.includes("mac") || platform.includes("darwin")) {
      return "macos"
    }
    if (platform.includes("linux")) {
      return "linux"
    }
    if (platform.includes("win")) {
      return "win"
    }
  } catch {
  }

  return "unknown"
}

function shouldShowBanner(): boolean {
  const os = getOS()
  return os === "macos" || os === "linux"
}

export function AppWarningBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const dismissed = safeGetLocalStorageItem(LOCAL_STORAGE_KEY)
    const showBanner = dismissed !== "true" && shouldShowBanner()
    setIsVisible(showBanner)
  }, [])

  const handleClose = () => {
    safeSetLocalStorageItem(LOCAL_STORAGE_KEY, "true")
    setIsVisible(false)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div
      data-testid="app-warning-banner"
      className="w-full border-b"
      style={{
        backgroundColor: "oklch(0.98 0.06 50)",
        borderColor: "oklch(0.75 0.12 45)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <p
          className="text-sm"
          style={{
            color: "oklch(0.4 0.15 45)",
          }}
        >
          ⚠️ This app is not fully tested on macOS and Linux.{" "}
          <a
            href="https://github.com/lawrenceching/SMM/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{
              color: "oklch(0.4 0.18 40)",
            }}
          >
            report BUG
          </a>{" "}
          if you encounter any issues.
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClose}
          style={{
            color: "oklch(0.4 0.15 45)",
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
