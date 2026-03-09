import { basename } from "@/lib/path"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckIcon, MinusIcon } from "lucide-react"

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

export function TvShowEpisodeTable({ data }: TvShowEpisodeTableProps) {
  return (
    <section className="rounded-lg border bg-card">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 w-[140px] px-2 py-1">ID</TableHead>
            <TableHead className="h-8 w-[70px] px-2 py-1 text-center">Thumbnail</TableHead>
            <TableHead className="h-8 px-2 py-1">Video File</TableHead>
            <TableHead className="h-8 w-[70px] px-2 py-1 text-center">Subtitle</TableHead>
            <TableHead className="h-8 w-[70px] px-2 py-1 text-center">NFO</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            if (row.type === "divider") {
              return (
                <TableRow key={`${row.id}-${index}`} className="hover:bg-muted/50">
                  <TableCell colSpan={5} className="px-2 py-1.5 font-medium">
                    {row.text}
                  </TableCell>
                </TableRow>
              )
            }

            return (
              <TableRow key={`${row.id}-${index}`}>
                <TableCell className="px-2 py-1 font-mono">{row.id}</TableCell>
                <TableCell className="px-2 py-1 text-center">
                  <CheckCell value={row.thumbnail} />
                </TableCell>
                <TableCell className="max-w-px px-2 py-1">
                  {row.videoFile ? (
                    <div className="min-w-0">
                      <div className="truncate">{basename(row.videoFile) ?? row.videoFile}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{row.videoFile}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-1 text-center">
                  <CheckCell value={row.subtitle} />
                </TableCell>
                <TableCell className="px-2 py-1 text-center">
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
