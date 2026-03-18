import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

const FEEDBACK_LINKS = [
  {
    id: "github-issues",
    url: "https://github.com/lawrenceching/SMM/issues",
    titleKey: "feedback.links.githubIssues.title",
    defaultTitle: "GitHub · Report Bugs",
    descKey: "feedback.links.githubIssues.description",
    defaultDesc: "Open GitHub Issues to report bugs.",
  },
  {
    id: "github-discussions",
    url: "https://github.com/lawrenceching/SMM/discussions/landing",
    titleKey: "feedback.links.githubDiscussions.title",
    defaultTitle: "GitHub · Feedback or Discussion",
    descKey: "feedback.links.githubDiscussions.description",
    defaultDesc: "Open GitHub Discussions for feedback and questions.",
  },
  {
    id: "gitcode-issues",
    url: "https://gitcode.com/lawrenceching/simple-media-manager/issues",
    titleKey: "feedback.links.gitcodeIssues.title",
    defaultTitle: "GitCode · 反馈问题（中国大陆）",
    descKey: "feedback.links.gitcodeIssues.description",
    defaultDesc: "Open GitCode Issues (recommended in mainland China).",
  },
  {
    id: "gitcode-discussions",
    url: "https://gitcode.com/lawrenceching/simple-media-manager/discussions",
    titleKey: "feedback.links.gitcodeDiscussions.title",
    defaultTitle: "GitCode · 讨论/社区论坛（中国大陆）",
    descKey: "feedback.links.gitcodeDiscussions.description",
    defaultDesc: "Open GitCode Discussions (recommended in mainland China).",
  },
] as const

export function Feedback() {
  const { t } = useTranslation('settings')

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('feedback.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('feedback.description')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEEDBACK_LINKS.map((link) => (
          <div
            key={link.id}
            className="rounded-lg border bg-card p-4"
            data-testid={`feedback-link-${link.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium leading-6">
                  {t(link.titleKey, { defaultValue: link.defaultTitle })}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t(link.descKey, { defaultValue: link.defaultDesc })}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openLink(link.url)}
                aria-label={t('feedback.openLink', { defaultValue: 'Open link' })}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3">
              <Button variant="secondary" className="w-full" onClick={() => openLink(link.url)}>
                {t('feedback.open', { defaultValue: 'Open' })}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

