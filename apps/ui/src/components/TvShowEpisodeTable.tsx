import { basename, relative } from "@/lib/path"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MinusIcon } from "lucide-react"
import { useState, useMemo } from "react"

export interface TvShowEpisodeDividerRow {
  id: string
  type: "divider"
  text: string
}

export interface TvShowEpisodeDataRow {
  id: string
  type: "episode"
  videoFile: string | undefined
  thumbnail: string | undefined
  subtitle: string | undefined
  nfo: string | undefined
}

export type TvShowEpisodeTableRow = TvShowEpisodeDividerRow | TvShowEpisodeDataRow

interface TvShowEpisodeTableProps {
  data: TvShowEpisodeTableRow[]
  /** When set, video paths are shown relative to this path. */
  mediaFolderPath?: string
}

function CheckCell({ value }: { value: string | undefined }) {
  const checked = value !== undefined

  if (checked) {
    return (
      <div className="flex items-center justify-center">
        <CheckIcon className="size-3.5 text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center">
      <MinusIcon className="size-3.5 text-muted-foreground" />
    </div>
  )
}

function getDisplayPath(fullPath: string, basePath: string | undefined): string {
  if (!basePath) return fullPath
  try {
    return relative(basePath, fullPath)
  } catch {
    return fullPath
  }
}

export function TvShowEpisodeTable({ data, mediaFolderPath }: TvShowEpisodeTableProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  console.log("[TvShowEpisodeTable] render", { dataLength: data.length, firstRowId: data[0]?.id ?? "(empty)" })

  const sectionIdByIndex = useMemo(() => {
    const map = new Map<number, string>()
    let currentId = ""
    data.forEach((row, index) => {
      if (row.type === "divider") {
        currentId = row.id
      }
      map.set(index, currentId)
    })
    return map
  }, [data])

  const toggleCollapsed = (dividerId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dividerId)) next.delete(dividerId)
      else next.add(dividerId)
      return next
    })
  }

  return (
    <section className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 w-[100px] px-2 py-1">ID</TableHead>
            <TableHead className="h-8 min-w-0 px-2 py-1">Video File</TableHead>
            <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title="Thumbnail">Thumb</TableHead>
            <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap" title="Subtitle">Sub</TableHead>
            <TableHead className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap">NFO</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            if (row.type === "divider") {
              const isCollapsed = collapsedIds.has(row.id)
              return (
                <TableRow key={`${row.id}-${index}`} className="bg-muted/60 hover:bg-muted/70">
                  <TableCell colSpan={5} className="px-2 py-1.5 font-semibold">
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.text}</span>
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(row.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={isCollapsed ? "展开" : "收起"}
                        aria-label={isCollapsed ? "展开" : "收起"}
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            const sectionId = sectionIdByIndex.get(index)
            if (sectionId && collapsedIds.has(sectionId)) {
              return null
            }

            return (
              <TableRow key={`${row.id}-${index}`}>
                <TableCell className="px-2 py-1 font-mono">{row.id}</TableCell>
                <TableCell className="max-w-px px-2 py-1">
                  {row.videoFile ? (
                    <div className="min-w-0">
                      <div className="truncate">{basename(row.videoFile) ?? row.videoFile}</div>
                      <div className="truncate text-[11px] text-muted-foreground" title={row.videoFile}>
                        {getDisplayPath(row.videoFile, mediaFolderPath)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={row.thumbnail} />
                </TableCell>
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={row.subtitle} />
                </TableCell>
                <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                  <CheckCell value={row.nfo} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
