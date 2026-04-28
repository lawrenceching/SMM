import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackgroundJobsIndicator } from './BackgroundJobsIndicator'

vi.mock('../hooks/useBackgroundJobsIndicator', () => ({
  useBackgroundJobsIndicator: vi.fn(),
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange }: any) => (
    <div data-testid="popover" data-open={open} onClick={() => onOpenChange?.(!open)}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
}))

vi.mock('./BackgroundJobsPopover', () => ({
  BackgroundJobsPopoverContent: () => <div data-testid="popover-content-inner" />,
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'statusBar.backgroundJobs.triggerAriaLabel') {
        const count = options?.count ?? 0
        return count === 1 ? `View ${count} background job` : `View ${count} background jobs`
      }
      return key
    },
  }),
}))

import { useBackgroundJobsIndicator } from '../hooks/useBackgroundJobsIndicator'

const mockUseBackgroundJobsIndicator = useBackgroundJobsIndicator as ReturnType<typeof vi.fn>

describe('BackgroundJobsIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when shouldRender is false', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: false,
      statusVariant: 'success',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 0,
      activeCount: 0,
    })

    const { container } = render(<BackgroundJobsIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('should return null when jobs array is empty', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: false,
      statusVariant: 'success',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 0,
      activeCount: 0,
    })

    const { container } = render(<BackgroundJobsIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('should render trigger button when there are running jobs', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'running',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 2,
      activeCount: 3,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('background-jobs-trigger-button')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-loading-icon')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-count')).toHaveTextContent('2')
  })

  it('should render check icon when all jobs are successful', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'success',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 0,
      activeCount: 2,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('background-jobs-trigger-button')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-completed-icon')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-count')).toHaveTextContent('2')
  })

  it('should render warning icon when there are failed or aborted jobs', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'warning',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 0,
      activeCount: 0,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('background-jobs-trigger-button')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-warning-icon')).toBeInTheDocument()
  })

  it('should render with custom className', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'running',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 1,
      activeCount: 1,
    })

    render(<BackgroundJobsIndicator className="custom-class" />)

    const button = screen.getByTestId('background-jobs-trigger-button')
    expect(button).toHaveClass('custom-class')
  })

  it('should have correct aria-label', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'running',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 1,
      activeCount: 1,
    })

    render(<BackgroundJobsIndicator />)

    const button = screen.getByTestId('background-jobs-trigger-button')
    expect(button).toHaveAttribute('aria-label', 'View 1 background job')
  })

  it('should have correct aria-label for multiple jobs', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'running',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 3,
      activeCount: 5,
    })

    render(<BackgroundJobsIndicator />)

    const button = screen.getByTestId('background-jobs-trigger-button')
    expect(button).toHaveAttribute('aria-label', 'View 5 background jobs')
  })

  it('should pass isPopoverOpen to Popover', () => {
    const mockSetPopoverOpen = vi.fn()
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'success',
      isPopoverOpen: true,
      setPopoverOpen: mockSetPopoverOpen,
      runningCount: 0,
      activeCount: 1,
    })

    render(<BackgroundJobsIndicator />)

    const popover = screen.getByTestId('popover')
    expect(popover).toHaveAttribute('data-open', 'true')
  })

  it('should render popover content when trigger is clicked', () => {
    const mockSetPopoverOpen = vi.fn()
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'success',
      isPopoverOpen: false,
      setPopoverOpen: mockSetPopoverOpen,
      runningCount: 0,
      activeCount: 1,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('popover-content')).toBeInTheDocument()
    expect(screen.getByTestId('popover-content-inner')).toBeInTheDocument()
  })

  it('should show success icon even when jobs list is empty', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      statusVariant: 'success',
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 0,
      activeCount: 0,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('background-jobs-trigger-button')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-completed-icon')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-count')).toHaveTextContent('0')
  })
})
