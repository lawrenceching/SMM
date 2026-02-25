import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import {
    StatusBar,
    mapWebSocketStatusToConnectionStatus,
} from "./StatusBar"
vi.mock("@/providers/config-provider", () => ({
    useConfig: () => ({
        appConfig: { version: "0.0.0-mock" },
    }),
}))

vi.mock("@/hooks/useWebSocket", () => ({
    useWebSocket: () => ({ status: "disconnected" as const }),
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
    })

    it("renders with testids and overrides", () => {
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
        render(<StatusBar />)
        expect(screen.getByTestId("app-version")).toHaveTextContent("0.0.0-mock")
    })
})
