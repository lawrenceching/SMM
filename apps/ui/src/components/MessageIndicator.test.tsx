import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MessageIndicator } from "./ConnectionStatusIndicator"

describe("MessageIndicator", () => {
    it("shows badge count for warning and error only", () => {
        render(
            <MessageIndicator
                messages={[
                    { title: "Informational", type: "info" },
                    { title: "Warning item", type: "warning" },
                    { title: "Error item", type: "error" },
                ]}
            />,
        )

        expect(screen.getByTestId("message-indicator-badge")).toHaveTextContent("2")
    })

    it("does not show badge when only info messages exist", () => {
        render(
            <MessageIndicator
                messages={[
                    { title: "TMDB is available", type: "info" },
                    { title: "TVDB is available", type: "info" },
                ]}
            />,
        )

        expect(screen.queryByTestId("message-indicator-badge")).not.toBeInTheDocument()
    })
})
