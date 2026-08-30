import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"
import { useEffect } from "react"
import { MEDIA_METADATA_UPDATED_EVENT } from "@smm/types/event-types"
import { MediaMetadataUpdatedEventListener } from "./MediaMetadataUpdatedEventListener"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"

const fetchMediaMetadataMock = vi.fn()
const refreshUserConfigMock = vi.fn()

vi.mock("@/hooks/mediaMetadata/useFetchMediaMetadataMutation", () => ({
  useFetchMediaMetadataMutation: () => ({
    mutateAsync: fetchMediaMetadataMock,
  }),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({
    refreshUserConfig: refreshUserConfigMock,
  }),
}))

vi.mock("react-use", () => ({
  useMount: (cb: () => void) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, [])
  },
  useUnmount: (cb: () => void) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => cb(), [])
  },
}))

describe("MediaMetadataUpdatedEventListener", () => {
  beforeEach(() => {
    fetchMediaMetadataMock.mockReset()
    refreshUserConfigMock.mockReset()
    fetchMediaMetadataMock.mockResolvedValue(undefined)
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("refetches metadata when the event folder matches the selected sidebar folder", async () => {
    useUIMediaFolderStore.setState({ selectedFolder: "/media/ShowA" })
    render(<MediaMetadataUpdatedEventListener />)

    await act(async () => {
      document.dispatchEvent(
        new CustomEvent(`socket.io_${MEDIA_METADATA_UPDATED_EVENT}`, {
          detail: { folderPath: "/media/ShowA" },
        }),
      )
    })

    expect(fetchMediaMetadataMock).toHaveBeenCalledWith({ path: "/media/ShowA" })
  })

  it("ignores metadata updates for folders that are not selected", async () => {
    useUIMediaFolderStore.setState({ selectedFolder: "/media/ShowA" })
    render(<MediaMetadataUpdatedEventListener />)

    await act(async () => {
      document.dispatchEvent(
        new CustomEvent(`socket.io_${MEDIA_METADATA_UPDATED_EVENT}`, {
          detail: { folderPath: "/media/ShowB" },
        }),
      )
    })

    expect(fetchMediaMetadataMock).not.toHaveBeenCalled()
  })

  it("refreshes user config when folderPath is missing", async () => {
    render(<MediaMetadataUpdatedEventListener />)

    await act(async () => {
      document.dispatchEvent(
        new CustomEvent(`socket.io_${MEDIA_METADATA_UPDATED_EVENT}`, {
          detail: {},
        }),
      )
    })

    expect(fetchMediaMetadataMock).not.toHaveBeenCalled()
    expect(refreshUserConfigMock).toHaveBeenCalled()
  })
})
