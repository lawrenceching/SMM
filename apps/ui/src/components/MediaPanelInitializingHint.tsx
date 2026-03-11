import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function MediaPanelInitializingHint() {
  const { t } = useTranslation(["components"]);

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{t("mediaFolder.initializing")}</p>
      </div>
    </div>
  );
}
