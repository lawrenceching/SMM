import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LocalFilePreviewImage } from "./LocalFilePreviewImage"
import { toLocalFileImageUrl } from "./toLocalFileImageUrl"
import { pathToFileURL } from "@smm/utils/url"
import { Path } from "@smm/utils/path"

vi.mock("@/components/Image", () => ({
  default: ({
    url,
    className,
  }: {
    url?: string
    className?: string
  }) => (
    <img
      data-testid="proxied-preview-image"
      data-url={url ?? ""}
      className={className}
      alt=""
    />
  ),
}))

describe("toLocalFileImageUrl", () => {
  it("converts a local path to file:// for authenticated Image loading", () => {
    const path = "/tmp/smm-screenshots/shot_001.jpg"
    const url = toLocalFileImageUrl(path)
    expect(url).toBe(pathToFileURL(Path.toPlatformPath(path)))
    expect(url).not.toContain("/api/image")
  })

  it("leaves existing file:// URLs unchanged", () => {
    expect(toLocalFileImageUrl("file:///tmp/a.jpg")).toBe("file:///tmp/a.jpg")
  })
})

describe("LocalFilePreviewImage", () => {
  it("loads via authenticated Image with file://, not raw /api/image img src", () => {
    const path = "/tmp/smm-screenshots/shot_001.jpg"
    render(
      <LocalFilePreviewImage
        path={path}
        className="preview-class"
        onActivate={vi.fn()}
      />,
    )

    const img = screen.getByTestId("proxied-preview-image")
    const url = img.getAttribute("data-url") ?? ""

    expect(url).toBe(pathToFileURL(Path.toPlatformPath(path)))
    expect(url).not.toContain("/api/image")
    expect(document.querySelector('img[src*="/api/image"]')).toBeNull()
  })

  it("passes file:// URL to onActivate on click", () => {
    const onActivate = vi.fn()
    const path = "/tmp/smm-screenshots/shot_001.jpg"
    render(<LocalFilePreviewImage path={path} onActivate={onActivate} />)

    fireEvent.click(screen.getByRole("button"))
    expect(onActivate).toHaveBeenCalledWith(
      pathToFileURL(Path.toPlatformPath(path)),
    )
  })
})
