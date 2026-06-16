import type { ComponentType, FC } from "react"
import { FolderOpen, Download, FileVideo, Github, ArrowUpRight } from "lucide-react"
import { Separator } from "./ui/separator"
import { useDialogs } from "@/providers/dialog-provider"
import { useTranslation } from "@/lib/i18n"
import { useFeatures } from "@/hooks/useFeatures"
import { cn } from "@/lib/utils"

const GITHUB_REPO_URL = "https://github.com/lawrenceching/SMM"
const GITCODE_REPO_URL = "https://gitcode.com/lawrenceching/SMM"

export interface WelcomeProps {
  /**
   * Triggered when the user clicks the "Import Folder" card.
   * Should match the behavior of `SMM → Open Folder` in the top-left menu
   * (e.g. `handleOpenFolderMenuClick` from `AppV2`).
   */
  onImportFolderClick?: () => void
}

type WelcomeFeatureCardTitleKey =
  | "welcome.featureCards.importFolder"
  | "welcome.featureCards.downloadVideo"
  | "welcome.featureCards.formatConversion"
  | "welcome.featureCards.github"

interface FeatureCardSpec {
  id: string
  /** lucide-react icon component */
  Icon: ComponentType<{ className?: string }>
  /** i18n key for the card title */
  titleKey: WelcomeFeatureCardTitleKey
  /** Tailwind classes for the icon container background */
  iconBgClass: string
  /** Tailwind classes for the icon container shadow / glow */
  iconShadowClass: string
  /** Tailwind classes for the hover gradient overlay */
  overlayClass: string
}

const FEATURE_CARDS: FeatureCardSpec[] = [
  {
    id: "import-folder",
    Icon: FolderOpen,
    titleKey: "welcome.featureCards.importFolder",
    iconBgClass: "from-emerald-400 to-emerald-600",
    iconShadowClass: "shadow-emerald-500/30",
    overlayClass: "from-emerald-500/10 via-emerald-500/5",
  },
  {
    id: "download-video",
    Icon: Download,
    titleKey: "welcome.featureCards.downloadVideo",
    iconBgClass: "from-sky-400 to-blue-600",
    iconShadowClass: "shadow-blue-500/30",
    overlayClass: "from-sky-500/10 via-sky-500/5",
  },
  {
    id: "format-conversion",
    Icon: FileVideo,
    titleKey: "welcome.featureCards.formatConversion",
    iconBgClass: "from-violet-400 to-purple-600",
    iconShadowClass: "shadow-violet-500/30",
    overlayClass: "from-violet-500/10 via-violet-500/5",
  },
  {
    id: "github",
    Icon: Github,
    titleKey: "welcome.featureCards.github",
    iconBgClass: "from-slate-600 to-zinc-800",
    iconShadowClass: "shadow-slate-500/30",
    overlayClass: "from-slate-500/10 via-slate-500/5",
  },
]

const FeatureCard: FC<{
  spec: FeatureCardSpec
  title: string
  onClick: () => void
  href?: string
  className?: string
}> = ({ spec, title, onClick, href, className }) => {
  const { Icon } = spec
  const baseClassName = cn(
    "group relative flex flex-col items-start gap-5 p-5",
    "rounded-2xl border bg-card text-card-foreground",
    "overflow-hidden text-left",
    "transition-all duration-300 ease-out",
    "hover:shadow-xl hover:-translate-y-1 hover:border-foreground/20",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "min-h-[180px]",
    className,
  )

  const inner = (
    <>
      {/* Hover gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent opacity-0",
          "group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
          spec.overlayClass,
        )}
        aria-hidden="true"
      />
      {/* Top row: icon + arrow indicator */}
      <div className="relative flex w-full items-start justify-between">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-xl",
            "bg-gradient-to-br shadow-lg",
            "group-hover:scale-110 group-hover:rotate-3",
            "transition-transform duration-300 ease-out",
            spec.iconBgClass,
            spec.iconShadowClass,
          )}
        >
          <Icon className="size-6 text-white drop-shadow-sm" aria-hidden="true" />
        </div>
        <ArrowUpRight
          className={cn(
            "size-5 text-muted-foreground",
            "opacity-0 -translate-x-1 -translate-y-1",
            "group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0",
            "transition-all duration-300 ease-out",
          )}
          aria-hidden="true"
        />
      </div>
      {/* Title */}
      <div className="relative mt-auto text-base font-semibold leading-tight">
        {title}
      </div>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`welcome-card-${spec.id}`}
        className={cn(baseClassName, "no-underline")}
      >
        {inner}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`welcome-card-${spec.id}`}
      className={cn(baseClassName, "cursor-pointer")}
    >
      {inner}
    </button>
  )
}

const Welcome: FC<WelcomeProps> = ({ onImportFolderClick }) => {
  const { downloadVideoDialog, formatConverterDialog } = useDialogs()
  const [openDownloadVideo] = downloadVideoDialog
  const [openFormatConverter] = formatConverterDialog
  const { isDisplayFeatureCardsInWelcomeEnabled, isDownloadVideoEnabled, isFormatConverterEnabled } = useFeatures()
  const { t } = useTranslation("components")

  if (!isDisplayFeatureCardsInWelcomeEnabled) {
    return (
      <div className={`flex justify-center items-center h-full w-full`}>
        <div>
          <div className="space-y-1">
            <h4 className="text-sm leading-none font-medium">Simple Media Manager</h4>
            <p className="text-muted-foreground text-sm">
              A simple media manager powered by AI.
            </p>
          </div>
          <Separator className="my-4" />
          <div className="flex h-5 items-center space-x-4 text-sm">
            <div><a target="_blank" href={GITHUB_REPO_URL}>Github</a></div>
            <Separator orientation="vertical" />
            <div><a target="_blank" href={GITCODE_REPO_URL}>GitCode</a></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-full w-full px-6 py-10 overflow-auto">
      {/* Decorative background orbs */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] rounded-full bg-sky-500/5 dark:bg-sky-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-10 space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Simple Media Manager</h1>
          <p className="text-muted-foreground text-sm">
            A simple media manager powered by AI.
          </p>
        </div>

        {/* Feature cards:
           flex-wrap auto-wraps based on available space.
           min-w-[200px] prevents narrow cards; flex-1 grows to fill space. */}
        <div className="flex flex-wrap justify-center gap-4 w-full max-w-5xl">
          {FEATURE_CARDS.map((spec) => {
            const title = t(spec.titleKey)
            const cardClassName = "min-w-[200px] flex-1"
            if (spec.id === "import-folder") {
              return (
                <FeatureCard
                  key={spec.id}
                  spec={spec}
                  title={title}
                  onClick={() => onImportFolderClick?.()}
                  className={cardClassName}
                />
              )
            }
            if (spec.id === "download-video") {
              if (!isDownloadVideoEnabled) return null
              return (
                <FeatureCard
                  key={spec.id}
                  spec={spec}
                  title={title}
                  onClick={() => openDownloadVideo()}
                  className={cardClassName}
                />
              )
            }
            if (spec.id === "format-conversion") {
              if (!isFormatConverterEnabled) return null
              return (
                <FeatureCard
                  key={spec.id}
                  spec={spec}
                  title={title}
                  onClick={() => openFormatConverter()}
                  className={cardClassName}
                />
              )
            }
            // github
            return (
              <FeatureCard
                key={spec.id}
                spec={spec}
                title={title}
                onClick={() => {}}
                href={GITHUB_REPO_URL}
                className={cardClassName}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Welcome
