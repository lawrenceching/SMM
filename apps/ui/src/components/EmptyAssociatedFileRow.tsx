import { useTranslation } from "@/lib/i18n"

const subgridRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "subgrid",
  gridColumn: "1 / -1",
}

export function EmptyAssociatedFileRow() {
  const { t } = useTranslation(["components"])

  return (
    <div
      style={subgridRowStyle}
      role="row"
      className="text-xs text-muted-foreground/60"
    >
      <div role="cell" className="col-span-full py-1.5 text-center italic">
        {t("localFileTableRow.noAssociatedFiles")}
      </div>
    </div>
  )
}
