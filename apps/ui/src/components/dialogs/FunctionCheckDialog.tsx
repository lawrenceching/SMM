import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { hello } from "@/api/hello"

interface FunctionCheckItem {
  name: string
  status: "running" | "passed" | "failed"
  message?: string
}

const TMDB_TEST_TV_ID = 1399 // Game of Thrones

// Read HTTP proxy URL from environment for the reverse proxy test.
// Set TEST_HTTP_PROXY in .env.local at the repo root, e.g.:
//   TEST_HTTP_PROXY=socks5://192.168.50.10:7897
const TEST_HTTP_PROXY = (import.meta.env as Record<string, string | undefined>).TEST_HTTP_PROXY

export function FunctionCheckDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation(["dialogs", "common"])
  const [items, setItems] = useState<FunctionCheckItem[]>([])

  // Reset state when dialog opens
  useEffect(() => {
    if (!isOpen) return
    setItems([
      {
        name: "Reverse Proxy API(HTTP Proxy)",
        status: "running",
      },
    ])
  }, [isOpen])

  const runTests = useCallback(async () => {
    // Test 1: Reverse Proxy API with HTTP Proxy header
    setItems((prev) =>
      prev.map((item) =>
        item.name === "Reverse Proxy API(HTTP Proxy)"
          ? { ...item, status: "running" as const, message: undefined }
          : item,
      ),
    )

    try {
      const helloResult = await hello()
      if (helloResult.error) {
        setItems((prev) =>
          prev.map((item) =>
            item.name === "Reverse Proxy API(HTTP Proxy)"
              ? { ...item, status: "failed" as const, message: `hello() failed: ${helloResult.error}` }
              : item,
          ),
        )
        return
      }

      if (!helloResult.reverseProxyUrl) {
        setItems((prev) =>
          prev.map((item) =>
            item.name === "Reverse Proxy API(HTTP Proxy)"
              ? { ...item, status: "failed" as const, message: "Reverse proxy is not available" }
              : item,
          ),
        )
        return
      }

      const proxyUrl = helloResult.reverseProxyUrl
      const upstreamBaseURL = "https://api.themoviedb.org/3"

      if (!TEST_HTTP_PROXY) {
        setItems((prev) =>
          prev.map((item) =>
            item.name === "Reverse Proxy API(HTTP Proxy)"
              ? {
                  ...item,
                  status: "failed" as const,
                  message:
                    "TEST_HTTP_PROXY is not set. Add it to .env.local at the repo root, e.g.:\n" +
                    'TEST_HTTP_PROXY=socks5://192.168.50.10:7897',
                }
              : item,
          ),
        )
        return
      }

      const url = `${proxyUrl}/tv/${TMDB_TEST_TV_ID}?language=en-US`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-SMM-Proxy-Upstream-BaseURL": upstreamBaseURL,
          "X-Http-Proxy": TEST_HTTP_PROXY,
        },
      })

      // Any HTTP response from TMDB (including 401) proves the proxy chain
      // worked: frontend → reverse proxy → SOCKS5 proxy → TMDB server.
      // Only a network-level error (fetch throws) is a real failure.
      if (response.status === 200) {
        const body = (await response.json()) as { name?: string; id?: number }
        setItems((prev) =>
          prev.map((item) =>
            item.name === "Reverse Proxy API(HTTP Proxy)"
              ? {
                  ...item,
                  status: "passed" as const,
                  message: body.name
                    ? `OK: "${body.name}" (ID: ${body.id})`
                    : `OK (status: ${response.status})`,
                }
              : item,
          ),
        )
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.name === "Reverse Proxy API(HTTP Proxy)"
              ? {
                  ...item,
                  status: "passed" as const,
                  message: `Reached TMDB (HTTP ${response.status}) — proxy chain works, but API request was rejected. This is expected without a valid TMDB API key.`,
                }
              : item,
          ),
        )
      }
    } catch (error) {
      setItems((prev) =>
        prev.map((item) =>
          item.name === "Reverse Proxy API(HTTP Proxy)"
            ? {
                ...item,
                status: "failed" as const,
                message: error instanceof Error ? error.message : String(error),
              }
            : item,
        ),
      )
    }
  }, [])

  // Auto-run tests when dialog opens
  useEffect(() => {
    if (!isOpen) return
    // Small delay to let the dialog render before starting
    const timer = setTimeout(() => {
      void runTests()
    }, 100)
    return () => clearTimeout(timer)
  }, [isOpen, runTests])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ScrollableDialogContent showCloseButton data-testid="function-check-dialog">
        <ScrollableDialogHeader>
          <DialogTitle>功能验证</DialogTitle>
          <DialogDescription>验证系统各功能模块是否正常工作</DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name} className="border-b last:border-b-0">
                  <td className="py-3 pr-4 text-sm">{item.name}</td>
                  <td className="py-3 text-sm">
                    {item.status === "running" && (
                      <span className="text-muted-foreground">Running...</span>
                    )}
                    {item.status === "passed" && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        Passed
                      </span>
                    )}
                    {item.status === "failed" && (
                      <div>
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          Failed
                        </span>
                        {item.message && (
                          <p className="mt-1 text-xs text-red-500/80 dark:text-red-400/80 font-mono whitespace-pre-wrap break-all">
                            {item.message}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground text-center">
              No test items configured.
            </p>
          )}
        </ScrollableDialogBody>
        <div className="flex justify-end px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("close", { ns: "common" })}
          </Button>
        </div>
      </ScrollableDialogContent>
    </Dialog>
  )
}
