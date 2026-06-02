import { describe, it, expect, vi, beforeEach } from "vitest"
import { Path } from "@core/path"
import { convertVideo } from "./ffmpeg"
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion"

const NESTED_INPUT_POSIX = "/path/to/music/a/b/c/d/test.mp4"
const NESTED_OUTPUT_POSIX = "/path/to/music/a/b/c/d/test (1).mp4"

vi.mock("@/lib/whitelistedCmd/executeCmdToCompletion", () => ({
  executeCmdToCompletion: vi.fn(),
}))

describe("convertVideo executeCmd paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(executeCmdToCompletion).mockResolvedValue({
      success: true,
      stdout: "",
      stderr: "",
      exitCode: 0,
    })
  })

  it("passes deeply nested platform paths as ffmpeg -i and -y args", async () => {
    const expectedInput = new Path(NESTED_INPUT_POSIX).platformAbsPath()
    const expectedOutput = new Path(NESTED_OUTPUT_POSIX).platformAbsPath()

    await convertVideo({
      inputPath: NESTED_INPUT_POSIX,
      outputPath: NESTED_OUTPUT_POSIX,
      outputFormat: "mp4h264",
      preset: "balanced",
    })

    expect(executeCmdToCompletion).toHaveBeenCalledTimes(1)
    const request = vi.mocked(executeCmdToCompletion).mock.calls[0]![0]
    expect(request.command).toBe("ffmpeg")

    const args = request.args
    const inputIdx = args.indexOf("-i")
    const outputFlagIdx = args.lastIndexOf("-y")
    expect(inputIdx).toBeGreaterThanOrEqual(0)
    expect(outputFlagIdx).toBeGreaterThanOrEqual(0)
    expect(args[inputIdx + 1]).toBe(expectedInput)
    expect(args[outputFlagIdx + 1]).toBe(expectedOutput)
    expect(args[inputIdx + 1]).toContain("test.mp4")
    expect(args[inputIdx + 1]).not.toBe("test.mp4")
  })
})
