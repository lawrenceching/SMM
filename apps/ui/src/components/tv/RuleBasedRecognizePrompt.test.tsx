import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { RuleBasedRecognizePrompt } from './RuleBasedRecognizePrompt'

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; ns?: string }) => {
      const messages: Record<string, string> = {
        'toolbar.recognizeReviewPrompt': 'Please review',
        'toolbar.recognizing': 'Recognizing episodes…',
        'toolbar.notAllEpisodesRecognized': 'It seems not all episodes are recognized',
        'toolbar.ruleBasedRecognizeHint':
          'This recognition is based on an internally maintained rule set and cannot reliably recognize all files. We recommend using AI.',
        'toolbar.allPlanFilesUnchanged': 'Nothing to apply.',
      }
      return messages[key] ?? options?.defaultValue ?? key
    },
  }),
}))

describe('RuleBasedRecognizePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderPrompt(
    override: Partial<ComponentProps<typeof RuleBasedRecognizePrompt>> = {},
  ) {
    return render(<RuleBasedRecognizePrompt isOpen onConfirm={vi.fn()} onCancel={vi.fn()} {...override} />)
  }

  it('does not render the hint icon by default (notAllEpisodesRecognized=false)', () => {
    renderPrompt()
    expect(screen.queryByTestId('rule-based-recognize-hint-icon')).toBeNull()
    expect(screen.queryByTestId('rule-based-recognize-not-all-message')).toBeNull()
  })

  it('renders the hint icon and message when notAllEpisodesRecognized=true', () => {
    renderPrompt({ notAllEpisodesRecognized: true })
    expect(screen.getByTestId('rule-based-recognize-hint-icon')).toBeInTheDocument()
    expect(screen.getByTestId('rule-based-recognize-not-all-message')).toBeInTheDocument()
  })

  it('exposes the localized hint as the icon aria-label', () => {
    renderPrompt({ notAllEpisodesRecognized: true })
    const icon = screen.getByTestId('rule-based-recognize-hint-icon')
    expect(icon.getAttribute('aria-label')).toContain('internally maintained rule set')
  })

  it('reveals the tooltip content with the localized hint on hover', async () => {
    renderPrompt({ notAllEpisodesRecognized: true })

    fireEvent.mouseOver(screen.getByTestId('rule-based-recognize-hint-icon'))
    fireEvent.focus(screen.getByTestId('rule-based-recognize-hint-icon'))

    const tooltip = await screen.findByTestId('rule-based-recognize-hint-tooltip')
    expect(tooltip).toHaveTextContent(
      'This recognition is based on an internally maintained rule set and cannot reliably recognize all files. We recommend using AI.',
    )
  })

  it('hides the hint icon and message when isLoading=true', () => {
    renderPrompt({ isLoading: true, notAllEpisodesRecognized: true })
    expect(screen.queryByTestId('rule-based-recognize-hint-icon')).toBeNull()
    expect(screen.queryByTestId('rule-based-recognize-not-all-message')).toBeNull()
  })

  it('renders the unchanged message when allPlanFilesUnchanged=true', () => {
    renderPrompt({ allPlanFilesUnchanged: true })
    expect(screen.getByText('Nothing to apply.')).toBeInTheDocument()
  })
})
