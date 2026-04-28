import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Path } from "@core/path"
import {
    StatusBar,
    mapWebSocketStatusToConnectionStatus,
} from "./StatusBar"

vi.mock("@/stores/uiMediaFolderStore", () => ({
    useUIMediaFolderStoreState: vi.fn(),
}))

vi.mock("./hooks/useStatusBar", () => ({
    useStatusBar: vi.fn(),
    mapWebSocketStatusToConnectionStatus: vi.fn((status: string) => {
        if (status === 'connected') return 'connected'
        if (status === 'connecting') return 'connecting'
        return 'disconnected'
    }),
}))

vi.mock("./ConnectionStatusIndicator", () => ({
    MessageIndicator: ({ messages }: { messages: Array<{ title: string; type: string; link?: string }> }) => (
        <span
            data-testid="message-indicator"
            data-messages={JSON.stringify(messages)}
        />
    ),
}))

vi.mock("./background-jobs/BackgroundJobsIndicator", () => ({
    BackgroundJobsIndicator: () => <div data-testid="bg-jobs" />,
}))

vi.mock("./mcp/McpIndicator", () => ({
    McpIndicator: () => <div data-testid="mcp-indicator" />,
}))

vi.mock("@/hooks/useDatabaseConnectionStatus", () => ({
    useDatabaseConnectionStatus: vi.fn(),
}))
vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
    useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("@/components/ui/separator", () => ({
    Separator: () => <hr data-testid="separator" />,
}))

import { useStatusBar } from "./hooks/useStatusBar"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useDatabaseConnectionStatus } from "@/hooks/useDatabaseConnectionStatus"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const messages: Record<string, string> = {
                "statusBar.messages.tmdbUnavailable": "TMDB is unavailable",
                "statusBar.messages.tmdbAvailable": "TMDB is available",
                "statusBar.messages.tvdbUnavailable": "TVDB is unavailable",
                "statusBar.messages.tvdbAvailable": "TVDB is available",
                "statusBar.messages.videoCaptionerAvailable": "VideoCaptioner is available",
                "statusBar.messages.videoCaptionerNotFound": "videocaptioner not found",
            }
            return messages[key] ?? key
        },
    }),
}))

const mockUseStatusBar = useStatusBar as ReturnType<typeof vi.fn>
const mockUseUIMediaFolderStoreState = useUIMediaFolderStoreState as ReturnType<
    typeof vi.fn
>
const mockUseDatabaseConnectionStatus = useDatabaseConnectionStatus as ReturnType<typeof vi.fn>
const mockUseVideoCaptionerStatus = useVideoCaptionerStatus as ReturnType<typeof vi.fn>

describe("mapWebSocketStatusToConnectionStatus", () => {
    it("maps connected to connected", () => {
        expect(mapWebSocketStatusToConnectionStatus("connected")).toBe("connected")
    })

    it("maps connecting to connecting", () => {
        expect(mapWebSocketStatusToConnectionStatus("connecting")).toBe("connecting")
    })

    it("maps disconnected to disconnected", () => {
        expect(mapWebSocketStatusToConnectionStatus("disconnected")).toBe("disconnected")
    })

    it("maps error to disconnected", () => {
        expect(mapWebSocketStatusToConnectionStatus("error")).toBe("disconnected")
    })
})

describe("StatusBar", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseUIMediaFolderStoreState.mockReturnValue({
            folders: [],
            selectedFolder: "",
            selectedFolders: [],
        })
        mockUseStatusBar.mockReturnValue({
            version: '0.0.0-mock',
        })
        mockUseDatabaseConnectionStatus.mockReturnValue({
            tmdbStatus: "connected",
            tvdbStatus: "connected",
            hasWarning: false,
        })
        mockUseVideoCaptionerStatus.mockReturnValue({
            isAvailable: true,
            isChecking: false,
        })
    })

    it("renders with testids and overrides", () => {
        mockUseStatusBar.mockReturnValue({
            version: '1.2.3-test',
        })

        render(
            <StatusBar
                message="Test message"
                version="1.2.3-test"
            />
        )

        expect(screen.getByTestId("status-bar")).toBeInTheDocument()
        expect(screen.getByTestId("connection-status-indicator")).toBeInTheDocument()
        expect(screen.getByTestId("message-indicator")).toBeInTheDocument()
        expect(screen.getByTestId("status-bar-message")).toHaveTextContent("Test message")
        expect(screen.getByTestId("app-version")).toHaveTextContent("1.2.3-test")
        expect(screen.getByTestId("background-jobs-indicator")).toBeInTheDocument()
        expect(screen.getByTestId("mcp-indicator")).toBeInTheDocument()
    })

    it("uses default version from config when version override is not passed", () => {
        mockUseStatusBar.mockReturnValue({
            version: '0.0.0-mock',
        })

        render(<StatusBar />)
        expect(screen.getByTestId("app-version")).toHaveTextContent("0.0.0-mock")
    })

    it("passes version override to hook", () => {
        render(
            <StatusBar
                version="2.0.0"
            />
        )

        expect(mockUseStatusBar).toHaveBeenCalledWith({
            versionOverride: '2.0.0',
        })
    })

    it("renders status messages with TMDB and TVDB deterministic ordering", () => {
        mockUseDatabaseConnectionStatus.mockReturnValue({
            tmdbStatus: "disconnected",
            tvdbStatus: "connected",
            hasWarning: true,
        })

        render(<StatusBar />)

        expect(screen.getByTestId("message-indicator")).toHaveAttribute(
            "data-messages",
            JSON.stringify([
                { title: "TMDB is unavailable", type: "error" },
                { title: "TVDB is available", type: "info" },
                { title: "VideoCaptioner is available", type: "info" },
            ]),
        )
    })

    it("renders TVDB unavailable as error message", () => {
        mockUseDatabaseConnectionStatus.mockReturnValue({
            tmdbStatus: "connected",
            tvdbStatus: "disconnected",
            hasWarning: true,
        })

        render(<StatusBar />)

        expect(screen.getByTestId("message-indicator")).toHaveAttribute(
            "data-messages",
            JSON.stringify([
                { title: "TMDB is available", type: "info" },
                { title: "TVDB is unavailable", type: "error" },
                { title: "VideoCaptioner is available", type: "info" },
            ]),
        )
    })

    it("renders videocaptioner not found as error message", () => {
        mockUseVideoCaptionerStatus.mockReturnValue({
            isAvailable: false,
            isChecking: false,
        })

        render(<StatusBar />)

        expect(screen.getByTestId("message-indicator")).toHaveAttribute(
            "data-messages",
            JSON.stringify([
                { title: "TMDB is available", type: "info" },
                { title: "TVDB is available", type: "info" },
                {
                    title: "videocaptioner not found",
                    type: "error",
                    link: "https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C",
                },
            ]),
        )
    })

    it("renders message from props", () => {
        mockUseStatusBar.mockReturnValue({
            version: '1.0.0',
        })

        render(<StatusBar message="Custom message" />)

        expect(screen.getByTestId("status-bar-message")).toHaveTextContent("Custom message")
    })

    it("shows selectedFolder from store as platform path when message is not passed", () => {
        mockUseUIMediaFolderStoreState.mockReturnValue({
            folders: [],
            selectedFolder: "/media/library",
            selectedFolders: [],
        })

        render(<StatusBar />)

        expect(screen.getByTestId("status-bar-message")).toHaveTextContent(
            Path.toPlatformPath("/media/library"),
        )
    })
})
