import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogDialog } from './LogDialog'

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('LogDialog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'X-Log-Truncated': 'false',
          'X-Log-Total-Bytes': '3',
          'X-Log-Read-Offset': '0',
          'X-Log-Read-Limit': '3',
        }),
        text: async () => 'abc',
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and shows raw log when open', async () => {
    renderWithClient(
      <LogDialog
        open
        onOpenChange={() => {}}
        executionId="00000000-0000-4000-8000-000000000001"
        jobTitle="Job A"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('abc')).toBeInTheDocument()
    })
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it(
    'polls more than once when isRunning is true',
    async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'X-Log-Truncated': 'false',
          'X-Log-Total-Bytes': '3',
          'X-Log-Read-Offset': '0',
          'X-Log-Read-Limit': '3',
        }),
        text: async () => 'abc',
      })
      vi.stubGlobal('fetch', fetchMock)

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      render(
        <QueryClientProvider client={client}>
          <LogDialog
            open
            onOpenChange={() => {}}
            executionId="00000000-0000-4000-8000-000000000001"
            jobTitle="Job A"
            isRunning
          />
        </QueryClientProvider>,
      )

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      await waitFor(
        () => {
          expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
        },
        { timeout: 4500, interval: 50 },
      )
    },
    6000,
  )
})
