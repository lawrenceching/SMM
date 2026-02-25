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

import { useBackgroundJobsIndicator } from '../hooks/useBackgroundJobsIndicator'

const mockUseBackgroundJobsIndicator = useBackgroundJobsIndicator as ReturnType<typeof vi.fn>

describe('BackgroundJobsIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when shouldRender is false', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: false,
      isRunning: false,
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
      isRunning: false,
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
      isRunning: true,
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

  it('should render check icon when jobs are pending (not running)', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      isRunning: false,
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 0,
      activeCount: 1,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('background-jobs-trigger-button')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-completed-icon')).toBeInTheDocument()
    expect(screen.getByTestId('background-jobs-count')).toHaveTextContent('1')
  })

  it('should render with custom className', () => {
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      isRunning: true,
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
      isRunning: true,
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
      isRunning: true,
      isPopoverOpen: false,
      setPopoverOpen: vi.fn(),
      runningCount: 3,
      activeCount: 5,
    })

    render(<BackgroundJobsIndicator />)

    const button = screen.getByTestId('background-jobs-trigger-button')
    expect(button).toHaveAttribute('aria-label', 'View 3 background jobs')
  })

  it('should pass isPopoverOpen to Popover', () => {
    const mockSetPopoverOpen = vi.fn()
    mockUseBackgroundJobsIndicator.mockReturnValue({
      shouldRender: true,
      isRunning: false,
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
      isRunning: false,
      isPopoverOpen: false,
      setPopoverOpen: mockSetPopoverOpen,
      runningCount: 0,
      activeCount: 1,
    })

    render(<BackgroundJobsIndicator />)

    expect(screen.getByTestId('popover-content')).toBeInTheDocument()
    expect(screen.getByTestId('popover-content-inner')).toBeInTheDocument()
  })
})
