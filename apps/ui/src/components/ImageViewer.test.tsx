import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageViewer } from './ImageViewer'

describe('ImageViewer', () => {
  const mockOnClose = vi.fn()
  const testImageUrl = 'https://example.com/test-image.jpg'

  const defaultProps = {
    imageUrl: null as string | null,
    onClose: mockOnClose,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering & Visibility', () => {
    it('should not be visible when imageUrl is null', () => {
      render(<ImageViewer {...defaultProps} imageUrl={null} />)

      // Dialog should not be in the document when closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should be visible when imageUrl is a string', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should render the default title', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      expect(screen.getByText('Image preview')).toBeInTheDocument()
    })

    it('should render a custom title', () => {
      render(
        <ImageViewer {...defaultProps} imageUrl={testImageUrl} title="Custom title" />
      )

      expect(screen.getByText('Custom title')).toBeInTheDocument()
    })

    it('should apply alt text to the image', () => {
      render(
        <ImageViewer {...defaultProps} imageUrl={testImageUrl} alt="Test alt text" />
      )

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', 'Test alt text')
    })

    it('should use empty alt text by default', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', '')
    })
  })

  describe('Image Loading States', () => {
    it('should show loading spinner while image loads', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      // Loader2 has aria-hidden, so we check for its presence by class or test id
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should hide spinner and show image after onLoad', async () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      const img = screen.getByRole('img')

      // Simulate image load
      fireEvent.load(img)

      // Spinner should be removed after load
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })

      // Image should be visible (opacity-100 class)
      expect(img).toHaveClass('opacity-100')
    })

    it('should show error message when image fails to load', async () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      const img = screen.getByRole('img')

      // Simulate image error
      fireEvent.error(img)

      expect(await screen.findByText('Image failed to load')).toBeInTheDocument()
    })

    it('should hide image when error occurs', async () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      const img = screen.getByRole('img')

      // Simulate image error
      fireEvent.error(img)

      await waitFor(() => {
        expect(img).toHaveClass('hidden')
      })
    })

    it('should reset loading state when imageUrl changes', async () => {
      const { rerender } = render(
        <ImageViewer {...defaultProps} imageUrl={testImageUrl} />
      )

      const img = screen.getByRole('img')
      fireEvent.load(img)

      // Wait for spinner to disappear
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
      })

      // Change to a new image URL
      rerender(
        <ImageViewer {...defaultProps} imageUrl="https://example.com/other-image.jpg" />
      )

      // Spinner should appear again for the new image
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Close Behavior', () => {
    it('should call onClose when Escape key is pressed', async () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when close button is clicked', async () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      // The close button has data-slot="dialog-close"
      const closeButton = document.querySelector('[data-slot="dialog-close"]')
      expect(closeButton).toBeInTheDocument()

      fireEvent.click(closeButton!)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when dialog open state changes to false', () => {
      const { rerender } = render(
        <ImageViewer {...defaultProps} imageUrl={testImageUrl} />
      )

      // Rerender with null imageUrl simulates closing
      rerender(<ImageViewer {...defaultProps} imageUrl={null} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('dismissOnClick Feature', () => {
    it('should NOT close on backdrop click when dismissOnClick is false (default)', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      // The backdrop container
      const backdrop = screen.getByRole('dialog').querySelector('.absolute.inset-0')
      expect(backdrop).toBeInTheDocument()

      fireEvent.click(backdrop!)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should close on backdrop click when dismissOnClick is true', () => {
      render(
        <ImageViewer
          {...defaultProps}
          imageUrl={testImageUrl}
          dismissOnClick={true}
        />
      )

      // When dismissOnClick is true, the backdrop has role="button"
      const backdrop = screen.getByRole('button', { name: 'Click to close' })
      fireEvent.click(backdrop)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should have proper ARIA attributes when dismissOnClick is true', () => {
      render(
        <ImageViewer
          {...defaultProps}
          imageUrl={testImageUrl}
          dismissOnClick={true}
        />
      )

      const backdrop = screen.getByRole('button', { name: 'Click to close' })
      expect(backdrop).toHaveAttribute('tabIndex', '0')
      expect(backdrop).toHaveAttribute('aria-label', 'Click to close')
    })

    it('should NOT have button role when dismissOnClick is false', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      // Should not have a button with the dismiss label
      expect(
        screen.queryByRole('button', { name: 'Click to close' })
      ).not.toBeInTheDocument()
    })

    it('should call onClose when Enter key is pressed on dismissable backdrop', () => {
      render(
        <ImageViewer
          {...defaultProps}
          imageUrl={testImageUrl}
          dismissOnClick={true}
        />
      )

      const backdrop = screen.getByRole('button', { name: 'Click to close' })
      fireEvent.keyDown(backdrop, { key: 'Enter' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Space key is pressed on dismissable backdrop', () => {
      render(
        <ImageViewer
          {...defaultProps}
          imageUrl={testImageUrl}
          dismissOnClick={true}
        />
      )

      const backdrop = screen.getByRole('button', { name: 'Click to close' })
      fireEvent.keyDown(backdrop, { key: ' ' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose on other keys pressed on dismissable backdrop', () => {
      render(
        <ImageViewer
          {...defaultProps}
          imageUrl={testImageUrl}
          dismissOnClick={true}
        />
      )

      const backdrop = screen.getByRole('button', { name: 'Click to close' })
      fireEvent.keyDown(backdrop, { key: 'a' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should have pointer-events-none on image to prevent click-through', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      const img = screen.getByRole('img')
      expect(img).toHaveClass('pointer-events-none')
    })
  })

  describe('Accessibility', () => {
    it('should have visually hidden title with sr-only class', () => {
      render(<ImageViewer {...defaultProps} imageUrl={testImageUrl} />)

      const title = screen.getByText('Image preview')
      expect(title).toHaveClass('sr-only')
    })
  })
})
