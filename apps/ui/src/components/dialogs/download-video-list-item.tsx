import type { ReactNode } from "react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import {
  bilibiliVideoDisplayTitle,
  getBilibiliVideoMetadata,
} from "@/api/ytdlp"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface ListItemProps {
  /** Shown next to the checkbox when {@link fetchVideoMetadata} is false. */
  label: ReactNode
  checked: boolean
  onToggle: () => void
  disabled?: boolean
  listItemTestId?: string
  checkboxTestId?: string
  /** Applied to the label span; e.g. `break-all` for long URLs. */
  labelClassName?: string
  /** When true, fetch title via yt-dlp `-J` for {@link videoUrl} (collection list). */
  fetchVideoMetadata?: boolean
  /** Video page URL for metadata fetch; required when `fetchVideoMetadata` is true. */
  videoUrl?: string
}

const VIDEO_METADATA_STALE_MS = 10 * 60 * 1000

function subscribePrefersReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {}
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function getPrefersReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotionSnapshot,
    () => false
  )
}

/** Shorten long URLs for the loading subtitle without hiding the BV id when possible. */
function truncateUrlPreview(url: string, maxLen = 56): string {
  const t = url.trim()
  if (t.length <= maxLen) return t
  const edge = Math.max(8, Math.floor((maxLen - 1) / 2))
  return `${t.slice(0, edge)}…${t.slice(-edge)}`
}

function FadeInContent({
  children,
  reducedMotion,
  animationKey,
}: {
  children: ReactNode
  reducedMotion: boolean
  /** Bumps when content identity changes so the enter animation runs once. */
  animationKey: string
}) {
  const [visible, setVisible] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true)
      return
    }
    setVisible(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVisible(true)
      })
    })
    return () => cancelAnimationFrame(id)
  }, [reducedMotion, animationKey])

  return (
    <span
      className={cn(
        "inline-block max-w-full transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-0.5 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"
      )}
    >
      {children}
    </span>
  )
}

function MetadataLoadingPlaceholder({ videoUrl }: { videoUrl: string }) {
  const preview = truncateUrlPreview(videoUrl)
  return (
    <span className="flex min-w-0 flex-col gap-1.5 motion-reduce:transition-none">
      <span className="flex min-w-0 items-center gap-2">
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden
        />
        <Skeleton className="h-4 min-w-0 flex-1 rounded-md motion-reduce:animate-none" />
      </span>
      <span
        className="text-muted-foreground/85 animate-pulse pl-7.5 text-xs motion-reduce:animate-none"
        title={videoUrl}
      >
        {preview}
      </span>
    </span>
  )
}

/**
 * Shared row for download dialog episode and collection lists: checkbox + label.
 */
export function ListItem({
  label,
  checked,
  onToggle,
  disabled,
  listItemTestId,
  checkboxTestId,
  labelClassName = "leading-snug",
  fetchVideoMetadata = false,
  videoUrl,
}: ListItemProps) {
  const shouldFetch = fetchVideoMetadata && !!videoUrl?.trim()
  const reducedMotion = usePrefersReducedMotion()

  const { data, isPending, isError } = useQuery({
    queryKey: ["ytdlp", "bilibiliVideoMetadata", videoUrl],
    queryFn: () => getBilibiliVideoMetadata(videoUrl!),
    enabled: shouldFetch,
    staleTime: VIDEO_METADATA_STALE_MS,
  })

  let textContent: ReactNode = label
  if (shouldFetch && videoUrl) {
    if (isPending) {
      textContent = <MetadataLoadingPlaceholder videoUrl={videoUrl} />
    } else if (isError) {
      textContent = (
        <FadeInContent
          reducedMotion={reducedMotion}
          animationKey={`err:${videoUrl}`}
        >
          <span className="break-all text-muted-foreground">{videoUrl}</span>
        </FadeInContent>
      )
    } else if (data) {
      const resolvedTitle = bilibiliVideoDisplayTitle(data)
      const display = resolvedTitle || videoUrl
      textContent = (
        <FadeInContent
          reducedMotion={reducedMotion}
          animationKey={`ok:${videoUrl}:${display}`}
        >
          {display}
        </FadeInContent>
      )
    }
  }

  return (
    <li
      data-testid={listItemTestId}
      {...(shouldFetch && isPending ? { "aria-busy": true as const } : {})}
    >
      <div className="flex cursor-pointer items-start gap-2 text-sm">
        <Checkbox
          data-testid={checkboxTestId}
          className="mt-0.5 shrink-0"
          checked={checked}
          onCheckedChange={() => onToggle()}
          disabled={disabled}
        />
        <span
          className={cn(
            labelClassName,
            shouldFetch && (isPending || data || isError) && "min-w-0 flex-1"
          )}
          onClick={() => !disabled && onToggle()}
        >
          {textContent}
        </span>
      </div>
    </li>
  )
}
