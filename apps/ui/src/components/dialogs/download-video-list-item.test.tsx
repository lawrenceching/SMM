import type { ReactElement } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ListItem } from "./download-video-list-item"

const h = vi.hoisted(() => ({
  getBilibiliVideoMetadata: vi.fn(),
}))

vi.mock("@/api/ytdlp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/ytdlp")>()
  return {
    ...actual,
    getBilibiliVideoMetadata: h.getBilibiliVideoMetadata,
  }
})

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("ListItem (download-video-list-item)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders label and does not fetch metadata when fetchVideoMetadata is false", () => {
    renderWithQueryClient(
      <ListItem
        label="Episode title"
        checked={false}
        onToggle={vi.fn()}
        listItemTestId="test-li"
        checkboxTestId="test-cb"
      />
    )

    expect(screen.getByText("Episode title")).toBeInTheDocument()
    expect(h.getBilibiliVideoMetadata).not.toHaveBeenCalled()
  })

  it("calls getBilibiliVideoMetadata and shows resolved fulltitle", async () => {
    const videoUrl = "https://www.bilibili.com/video/BV1resolved/"
    h.getBilibiliVideoMetadata.mockResolvedValue({
      _type: "video",
      id: "BV1resolved",
      title: "Short",
      fulltitle: "Resolved full title",
      webpage_url: videoUrl,
    })

    renderWithQueryClient(
      <ListItem
        label={videoUrl}
        fetchVideoMetadata
        videoUrl={videoUrl}
        checked
        onToggle={vi.fn()}
        listItemTestId="test-li"
        checkboxTestId="test-cb"
      />
    )

    await waitFor(() => {
      expect(h.getBilibiliVideoMetadata).toHaveBeenCalledWith(videoUrl)
    })
    await waitFor(() => {
      expect(screen.getByText("Resolved full title")).toBeInTheDocument()
    })
  })

  it("sets aria-busy and shows skeleton while metadata is loading", async () => {
    const videoUrl = "https://www.bilibili.com/video/BV1pending/"
    let resolveFetch!: (value: unknown) => void
    const deferred = new Promise((resolve) => {
      resolveFetch = resolve
    })
    h.getBilibiliVideoMetadata.mockImplementation(() => deferred)

    renderWithQueryClient(
      <ListItem
        label={videoUrl}
        fetchVideoMetadata
        videoUrl={videoUrl}
        checked={false}
        onToggle={vi.fn()}
        listItemTestId="test-li"
        checkboxTestId="test-cb"
      />
    )

    const li = screen.getByTestId("test-li")
    expect(li).toHaveAttribute("aria-busy", "true")
    expect(li.querySelector('[data-slot="skeleton"]')).toBeTruthy()

    resolveFetch({
      _type: "video",
      id: "BV1pending",
      title: "T",
      fulltitle: "Done",
      webpage_url: videoUrl,
    })

    await waitFor(() => {
      expect(li).not.toHaveAttribute("aria-busy")
    })
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument()
    })
  })

  it("falls back to video URL text when metadata fetch fails", async () => {
    const videoUrl = "https://www.bilibili.com/video/BV1fail/"
    h.getBilibiliVideoMetadata.mockRejectedValue(new Error("network"))

    renderWithQueryClient(
      <ListItem
        label={videoUrl}
        fetchVideoMetadata
        videoUrl={videoUrl}
        checked={false}
        onToggle={vi.fn()}
        listItemTestId="test-li"
        checkboxTestId="test-cb"
        labelClassName="break-all leading-snug"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(videoUrl)).toBeInTheDocument()
    })
  })

  it("invokes onToggle when checkbox changes", () => {
    const onToggle = vi.fn()
    renderWithQueryClient(
      <ListItem
        label="Row"
        checked={false}
        onToggle={onToggle}
        checkboxTestId="test-cb"
      />
    )

    fireEvent.click(screen.getByTestId("test-cb"))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
