import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileExplorer } from './FileExplorer'
import type { FileItem } from './dialogs/types'

// Mock the API functions
vi.mock('@/api/openFile', () => ({
  openFile: vi.fn(),
}))

vi.mock('@/api/listFiles', () => ({
  listFiles: vi.fn(),
}))

vi.mock('@/api/listDrives', () => ({
  listDrivesApi: vi.fn(),
}))

// Mock the translation hook
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

import { openFile } from '@/api/openFile'
import { listFiles } from '@/api/listFiles'

describe('FileExplorer', () => {
  const mockOnPathChange = vi.fn()
  const mockOnFileSelect = vi.fn()
  const mockOnFileDoubleClick = vi.fn()

  const defaultProps = {
    currentPath: '/test/path',
    onPathChange: mockOnPathChange,
    selectedFile: null,
    onFileSelect: mockOnFileSelect,
    onFileDoubleClick: mockOnFileDoubleClick,
    initialPath: '/test/path',
    showPathBar: true,
    onlyFolders: false,
    restrictToInitialPath: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock listFiles to return empty files list by default
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: '/test/path',
        items: [],
      },
      error: undefined,
    })
  })

  it('should call openFile when an image file is double-clicked', async () => {
    // Create a mock image file
    const imageFile: FileItem = {
      name: 'test-image.jpg',
      path: '/test/path/test-image.jpg',
      isDirectory: false,
      size: 1024,
      mtime: Date.now(),
    }

    // Mock listFiles to return the image file
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: '/test/path',
        items: [
          {
            path: imageFile.path,
            size: imageFile.size!,
            mtime: imageFile.mtime!,
            isDirectory: false,
          },
        ],
      },
      error: undefined,
    })

    // Mock openFile to resolve successfully
    vi.mocked(openFile).mockResolvedValue({
      data: {
        path: imageFile.path,
      },
      error: undefined,
    })

    render(<FileExplorer {...defaultProps} />)

    // Wait for the file list to load
    await screen.findByText('test-image.jpg')

    // Find the file item and double-click it
    const fileItem = screen.getByText('test-image.jpg')
    fireEvent.dblClick(fileItem)

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 0))

    // Assert that openFile was called with the correct path
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(openFile).toHaveBeenCalledWith('/test/path/test-image.jpg')
  })
})
