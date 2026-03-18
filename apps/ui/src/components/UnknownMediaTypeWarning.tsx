import { AlertTriangle, Check } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export type MediaType = "tvshow" | "movie" | "music" | "unknown"

export interface UnknownMediaTypeWarningProps {
  mediaType: MediaType
  onMediaTypeChange: (type: MediaType) => void
  onConfirm: () => void
  disabled?: boolean
}

export function UnknownMediaTypeWarning({
  mediaType,
  onMediaTypeChange,
  onConfirm,
  disabled,
}: UnknownMediaTypeWarningProps) {
  return (
    <div className="flex items-center gap-3 border-b border-amber-400/70 bg-amber-100 px-3 py-2.5 dark:border-amber-500/35 dark:bg-amber-950/45">
      <div className="rounded-md bg-card p-0.5 shadow-sm">
        <Select value={mediaType} onValueChange={(value) => onMediaTypeChange(value as MediaType)}>
          <SelectTrigger className="h-8 w-[120px] border-0 shadow-none">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tvshow">电视剧</SelectItem>
            <SelectItem value="movie">电影</SelectItem>
            <SelectItem value="music">音乐</SelectItem>
            <SelectItem value="unknown">选择类型...</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>请选择媒体类型</span>
      </div>

      <Button
        size="sm"
        className="h-8 bg-amber-600 px-4 font-medium text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
        onClick={onConfirm}
        disabled={disabled || mediaType === "unknown"}
      >
        <Check className="mr-2 h-4 w-4" />
        确认
      </Button>
    </div>
  )
}
