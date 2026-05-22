import { describe, it, expect } from "vitest"
import {
  getRowSubtitlePipelineState,
  buildRowSubtitleUi,
} from "./useMusicFolderSubtitlePipeline"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"

const row: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  path: "/music/song.mp3",
  title: "Song",
  artist: "Artist",
  duration: 60,
}

const emptySets = {
  transcribing: new Set<string>(),
  transcribeFailed: new Set<string>(),
  translating: new Set<string>(),
  translateFailed: new Set<string>(),
  synthesizing: new Set<string>(),
  synthesizeFailed: new Set<string>(),
  processing: new Set<string>(),
  processFailed: new Set<string>(),
}

describe("getRowSubtitlePipelineState", () => {
  it("marks transcribe running when path is in transcribing set", () => {
    const state = getRowSubtitlePipelineState(
      row,
      "/music",
      new Set(["/music/song.mp3"]),
      emptySets.transcribeFailed,
      emptySets.translating,
      emptySets.translateFailed,
      emptySets.synthesizing,
      emptySets.synthesizeFailed,
      emptySets.processing,
      emptySets.processFailed,
      new Map(),
      new Map(),
      true,
    )
    expect(state.transcribeStatus).toBe("running")
  })

  it("sets canTranslate from eligibility map", () => {
    const state = getRowSubtitlePipelineState(
      row,
      "/music",
      emptySets.transcribing,
      emptySets.transcribeFailed,
      emptySets.translating,
      emptySets.translateFailed,
      emptySets.synthesizing,
      emptySets.synthesizeFailed,
      emptySets.processing,
      emptySets.processFailed,
      new Map([["/music/song.mp3", true]]),
      new Map(),
      true,
    )
    expect(state.canTranslate).toBe(true)
  })
})

describe("buildRowSubtitleUi", () => {
  const t = (key: string) => key

  it("uses spinner index column when transcribing", () => {
    const ui = buildRowSubtitleUi(
      row,
      {
        transcribeStatus: "running",
        canTranslate: false,
        canSynthesize: false,
        canProcess: true,
      },
      false,
      false,
      true,
      true,
      true,
      true,
      t,
    )
    expect(ui.indexColumnVariant).toBe("spinner")
    expect(ui.indexColumnTooltip).toBe("mediaPlayer.transcribingTooltip")
  })
})
