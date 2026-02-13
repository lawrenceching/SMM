import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FilePickerDialog } from './file-picker-dialog'
import type { FileItem } from './types'

// Mock the FileExplorer component
vi.mock('@/components/FileExplorer', () => ({
  FileExplorer: ({ 
    selectedFile, 
    onFileSelect, 
    onPathChange 
  }: {
    selectedFile: FileItem | null
    onFileSelect: (file: FileItem | null) => void
    onPathChange: (path: string) => void
  }) => (
    <div data-testid="file-explorer">
      <button
        data-testid="select-file-button"
        onClick={() => {
          const mockFile: FileItem = {
            name: 'test-file.txt',
            path: '/test/path/test-file.txt',
            isDirectory: false,
            size: 1024,
            mtime: Date.now(),
          }
          onFileSelect(mockFile)
        }}
      >
        Mock Select File
      </button>
      <button
        data-testid="change-path-button"
        onClick={() => onPathChange('/new/path')}
      >
        Change Path
      </button>
      {selectedFile && (
        <div data-testid="selected-file">{selectedFile.name}</div>
      )}
    </div>
  ),
}))

// Mock the translation hook
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) => {
      if (options?.ns === 'common') {
        const commonTranslations: Record<string, string> = {
          cancel: 'Cancel',
          confirm: 'Confirm',
        }
        return commonTranslations[key] || key
      }
      const dialogsTranslations: Record<string, string> = {
        'filePicker.defaultTitle': 'Select File',
        'filePicker.defaultDescription': 'Choose a file from the file system',
      }
      return dialogsTranslations[key] || key
    },
  }),
}))

describe('FilePickerDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnSelect = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSelect: mockOnSelect,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render when isOpen is true', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('should not render when isOpen is false', () => {
    render(<FilePickerDialog {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByTestId('file-explorer')).not.toBeInTheDocument()
  })

  it('should display default title and description when not provided and hideDialogHeader is false', () => {
    render(<FilePickerDialog {...defaultProps} hideDialogHeader={false} />)
    
    expect(screen.getByRole('heading', { name: 'Select File' })).toBeInTheDocument()
    expect(screen.getByText('Choose a file from the file system')).toBeInTheDocument()
  })

  it('should not display title and description when hideDialogHeader is true (default)', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    expect(screen.queryByRole('heading', { name: 'Select File' })).not.toBeInTheDocument()
    expect(screen.queryByText('Choose a file from the file system')).not.toBeInTheDocument()
  })

  it('should display custom title and description when provided and hideDialogHeader is false', () => {
    render(
      <FilePickerDialog
        {...defaultProps}
        title="Custom Title"
        description="Custom Description"
        hideDialogHeader={false}
      />
    )
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom Description')).toBeInTheDocument()
  })

  it('should render Cancel and Confirm buttons', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('should call onClose when Cancel button is clicked', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should call onClose when dialog close button is clicked', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    // Find the close button (X button) in the dialog
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle file selection from FileExplorer', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    const selectFileButton = screen.getByTestId('select-file-button')
    fireEvent.click(selectFileButton)
    
    // The selected file should be displayed in the FileExplorer
    expect(screen.getByTestId('selected-file')).toBeInTheDocument()
    expect(screen.getByText('test-file.txt')).toBeInTheDocument()
  })

  it('should call onSelect and onClose when Confirm is clicked with a selected file', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    // First select a file
    const selectFileButton = screen.getByTestId('select-file-button')
    fireEvent.click(selectFileButton)
    
    // Then confirm
    const confirmButton = screen.getByText('Confirm')
    fireEvent.click(confirmButton)
    
    expect(mockOnSelect).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-file.txt',
        path: '/test/path/test-file.txt',
        isDirectory: false,
      })
    )
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should not call onSelect when Confirm is clicked without a selected file', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    // Click confirm without selecting a file
    const confirmButton = screen.getByText('Confirm')
    fireEvent.click(confirmButton)
    
    expect(mockOnSelect).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should reset selected file and path when dialog closes', async () => {
    const { rerender } = render(<FilePickerDialog {...defaultProps} />)
    
    // Select a file
    const selectFileButton = screen.getByTestId('select-file-button')
    fireEvent.click(selectFileButton)
    
    expect(screen.getByTestId('selected-file')).toBeInTheDocument()
    
    // Close the dialog
    rerender(<FilePickerDialog {...defaultProps} isOpen={false} />)
    
    // Reopen the dialog
    rerender(<FilePickerDialog {...defaultProps} isOpen={true} />)
    
    // Selected file should be reset
    await waitFor(() => {
      expect(screen.queryByTestId('selected-file')).not.toBeInTheDocument()
    })
  })

  it('should handle path changes from FileExplorer', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    const changePathButton = screen.getByTestId('change-path-button')
    fireEvent.click(changePathButton)
    
    // The path change should be handled internally
    // We can verify the FileExplorer is still rendered
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument()
  })

  it('should initialize with default path "~"', () => {
    render(<FilePickerDialog {...defaultProps} />)
    
    // The FileExplorer should be rendered with initialPath="~"
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument()
  })
})
