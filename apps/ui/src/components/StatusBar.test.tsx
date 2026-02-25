import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import {
    StatusBar,
    mapWebSocketStatusToConnectionStatus,
} from "./StatusBar"

vi.mock("./hooks/useStatusBar", () => ({
    useStatusBar: vi.fn(),
    mapWebSocketStatusToConnectionStatus: vi.fn((status: string) => {
        if (status === 'connected') return 'connected'
        if (status === 'connecting') return 'connecting'
        return 'disconnected'
    }),
}))

vi.mock("./ConnectionStatusIndicator", () => ({
    ConnectionStatusIndicator: ({ status }: { status: string }) => (
        <span data-testid="connection-dot" data-status={status} />
    ),
}))

vi.mock("./background-jobs/BackgroundJobsIndicator", () => ({
    BackgroundJobsIndicator: () => <div data-testid="bg-jobs" />,
}))

vi.mock("./mcp/McpIndicator", () => ({
    McpIndicator: () => <div data-testid="mcp-indicator" />,
}))

vi.mock("@/components/ui/separator", () => ({
    Separator: () => <hr data-testid="separator" />,
}))

import { useStatusBar } from "./hooks/useStatusBar"

const mockUseStatusBar = useStatusBar as ReturnType<typeof vi.fn>

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
        mockUseStatusBar.mockReturnValue({
            connectionStatus: 'disconnected',
            version: '0.0.0-mock',
        })
    })

    it("renders with testids and overrides", () => {
        mockUseStatusBar.mockReturnValue({
            connectionStatus: 'connected',
            version: '1.2.3-test',
        })

        render(
            <StatusBar
                message="Test message"
                connectionStatus="connected"
                version="1.2.3-test"
            />
        )

        expect(screen.getByTestId("status-bar")).toBeInTheDocument()
        expect(screen.getByTestId("connection-status-indicator")).toBeInTheDocument()
        expect(screen.getByTestId("connection-dot")).toHaveAttribute(
            "data-status",
            "connected"
        )
        expect(screen.getByTestId("status-bar-message")).toHaveTextContent("Test message")
        expect(screen.getByTestId("app-version")).toHaveTextContent("1.2.3-test")
        expect(screen.getByTestId("background-jobs-indicator")).toBeInTheDocument()
        expect(screen.getByTestId("mcp-indicator")).toBeInTheDocument()
    })

    it("uses default version from config when version override is not passed", () => {
        mockUseStatusBar.mockReturnValue({
            connectionStatus: 'disconnected',
            version: '0.0.0-mock',
        })

        render(<StatusBar />)
        expect(screen.getByTestId("app-version")).toHaveTextContent("0.0.0-mock")
    })

    it("passes connectionStatus override to hook", () => {
        render(
            <StatusBar
                connectionStatus="connected"
            />
        )

        expect(mockUseStatusBar).toHaveBeenCalledWith({
            connectionStatusOverride: 'connected',
            versionOverride: undefined,
        })
    })

    it("passes version override to hook", () => {
        render(
            <StatusBar
                version="2.0.0"
            />
        )

        expect(mockUseStatusBar).toHaveBeenCalledWith({
            connectionStatusOverride: undefined,
            versionOverride: '2.0.0',
        })
    })

    it("renders connection status from hook return value", () => {
        mockUseStatusBar.mockReturnValue({
            connectionStatus: 'connecting',
            version: '1.0.0',
        })

        render(<StatusBar />)

        expect(screen.getByTestId("connection-dot")).toHaveAttribute(
            "data-status",
            "connecting"
        )
    })

    it("renders message from props", () => {
        mockUseStatusBar.mockReturnValue({
            connectionStatus: 'disconnected',
            version: '1.0.0',
        })

        render(<StatusBar message="Custom message" />)

        expect(screen.getByTestId("status-bar-message")).toHaveTextContent("Custom message")
    })
})
