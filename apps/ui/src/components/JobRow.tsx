import { useTranslation, castTranslationFn } from "@/lib/i18n"
import { AnimatedDotsText } from "@/components/AnimatedDotsText"
import type { RunningJob } from "@/types/associated-files"

const subgridRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "subgrid",
  gridColumn: "1 / -1",
}

export interface JobRowProps {
  jobType: RunningJob["type"]
}

export function JobRow({ jobType }: JobRowProps) {
  const { t: tStrict } = useTranslation(["components"])
  const t = castTranslationFn(tStrict)

  const text = (() => {
    switch (jobType) {
      case "transcribing":
        return t("localFileTableRow.job.transcribing")
      case "translating":
        return t("localFileTableRow.job.translating")
      case "synthesising":
        return t("localFileTableRow.job.synthesising")
      case "processing":
        return t("localFileTableRow.job.processing")
      case "summarizing":
        return t("localFileTableRow.job.summarizing")
      default:
        return ""
    }
  })()

  return (
    <div
      style={subgridRowStyle}
      role="row"
      className="text-xs"
    >
      <div role="cell" />
      <div role="cell" />
      <div role="cell" className="col-span-3 flex items-center py-1.5 pl-2">
        <AnimatedDotsText text={text} className="font-normal tracking-normal" />
      </div>
      <div role="cell" />
    </div>
  )
}
