import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { LocalFileTableRowData } from "./MusicFileTable"
import {
  useMusicFolderSubtitlePipeline,
  buildRowSubtitleUi,
  type RowSubtitleUi,
} from "@/hooks/useMusicFolderSubtitlePipeline"
import { useTranslation } from "@/lib/i18n"
import {
  TranscribeDialog,
  SubtitleTranslationDialog,
  SynthesizeSubtitleDialog,
  ProcessPipelineDialog,
} from "@/components/dialogs"

export interface LocalFileSubtitleScopeProps {
  platformFolder: string
  mediaFolderPath?: string
  folderFiles?: string[] | null
  localRows: LocalFileTableRowData[]
  selectedLocalRows: LocalFileTableRowData[]
  onClearSelection?: () => void
  children: ReactNode
}

export interface LocalFileSubtitleContextValue {
  availability: {
    isTranscribeAvailable: boolean
    isTranslateAvailable: boolean
    isSynthesizeAvailable: boolean
    isProcessAvailable: boolean
  }
  hasTranscribeTargets: boolean
  hasTranslateTargets: boolean
  hasSynthesizeTargets: boolean
  hasProcessTargets: boolean
  headerActions: {
    onTranscribeClick: () => void
    onTranslateClick: () => void
    onSynthesizeClick: () => void
    onProcessClick: () => void
  }
  getRowSubtitleUi: (
    row: LocalFileTableRowData,
    isMultiSelectMode: boolean,
    isSelected: boolean,
  ) => RowSubtitleUi
  bindRowActions: (row: LocalFileTableRowData) => {
    onTranscribe: () => void
    onTranscribeStop: () => void
    onTranslate: () => void
    onTranslateStop: () => void
    onSynthesize: () => void
    onSynthesizeStop: () => void
    onProcess: () => void
    onProcessStop: () => void
  }
}

const LocalFileSubtitleContext = createContext<LocalFileSubtitleContextValue | null>(
  null,
)

export function useLocalFileSubtitle(): LocalFileSubtitleContextValue {
  const ctx = useContext(LocalFileSubtitleContext)
  if (!ctx) {
    throw new Error("useLocalFileSubtitle must be used within LocalFileSubtitleScope")
  }
  return ctx
}

const noop = () => {}

export function createMockLocalFileSubtitleContext(
  overrides?: Partial<LocalFileSubtitleContextValue>,
): LocalFileSubtitleContextValue {
  return {
    availability: {
      isTranscribeAvailable: true,
      isTranslateAvailable: true,
      isSynthesizeAvailable: true,
      isProcessAvailable: true,
    },
    hasTranscribeTargets: true,
    hasTranslateTargets: true,
    hasSynthesizeTargets: true,
    hasProcessTargets: true,
    headerActions: {
      onTranscribeClick: noop,
      onTranslateClick: noop,
      onSynthesizeClick: noop,
      onProcessClick: noop,
    },
    getRowSubtitleUi: (_row, isMultiSelectMode, isSelected) => ({
      indexColumnVariant: isMultiSelectMode || isSelected ? "checkbox" : "index",
      titleTooltip: _row.title,
      submenuDisabled: false,
      transcribeStartDisabled: false,
      translateStartDisabled: false,
      synthesizeStartDisabled: false,
      processStartDisabled: false,
      canTranslate: true,
      canSynthesize: true,
      canProcess: true,
    }),
    bindRowActions: () => ({
      onTranscribe: noop,
      onTranscribeStop: noop,
      onTranslate: noop,
      onTranslateStop: noop,
      onSynthesize: noop,
      onSynthesizeStop: noop,
      onProcess: noop,
      onProcessStop: noop,
    }),
    ...overrides,
  }
}

/** Storybook / tests: inject subtitle context without the full pipeline. */
export function LocalFileSubtitleMockProvider({
  children,
  value,
}: {
  children: ReactNode
  value?: Partial<LocalFileSubtitleContextValue>
}) {
  const ctx = useMemo(
    () => createMockLocalFileSubtitleContext(value),
    [value],
  )
  return (
    <LocalFileSubtitleContext.Provider value={ctx}>
      {children}
    </LocalFileSubtitleContext.Provider>
  )
}

export function LocalFileSubtitleScope({
  platformFolder,
  mediaFolderPath,
  folderFiles,
  localRows,
  selectedLocalRows,
  onClearSelection,
  children,
}: LocalFileSubtitleScopeProps) {
  const { t: tComponents } = useTranslation(["components"])
  // i18next TFunction overloads are not directly assignable to (key: string) => string
  const t = tComponents as unknown as (key: string) => string
  const pipeline = useMusicFolderSubtitlePipeline({
    platformFolder,
    mediaFolderPath,
    folderFiles,
    localRows,
    selectedLocalRows,
    onClearSelection,
  })

  const value = useMemo((): LocalFileSubtitleContextValue => {
    const { availability } = pipeline
    return {
      availability,
      hasTranscribeTargets: pipeline.hasTranscribeTargets,
      hasTranslateTargets: pipeline.hasTranslateTargets,
      hasSynthesizeTargets: pipeline.hasSynthesizeTargets,
      hasProcessTargets: pipeline.hasProcessTargets,
      headerActions: pipeline.headerActions,
      getRowSubtitleUi: (row, isMultiSelectMode, isSelected) => {
        const state = pipeline.getRowPipelineState(row)
        return buildRowSubtitleUi(
          row,
          state,
          isMultiSelectMode,
          isSelected,
          availability.isTranscribeAvailable,
          availability.isTranslateAvailable,
          availability.isSynthesizeAvailable,
          availability.isProcessAvailable,
          t,
        )
      },
      bindRowActions: pipeline.bindRowActions,
    }
  }, [pipeline, t])

  const { dialogProps } = pipeline

  return (
    <LocalFileSubtitleContext.Provider value={value}>
      <TranscribeDialog
        isOpen={dialogProps.transcribe.isOpen}
        onClose={dialogProps.transcribe.onClose}
        rows={dialogProps.transcribe.rows}
        defaultSelectedIds={dialogProps.transcribe.defaultSelectedIds}
        folder={dialogProps.transcribe.folder}
      />
      <SubtitleTranslationDialog
        isOpen={dialogProps.translate.isOpen}
        onClose={dialogProps.translate.onClose}
        rows={dialogProps.translate.rows}
        defaultSelectedIds={dialogProps.translate.defaultSelectedIds}
        folder={dialogProps.translate.folder}
      />
      <SynthesizeSubtitleDialog
        isOpen={dialogProps.synthesize.isOpen}
        onClose={dialogProps.synthesize.onClose}
        rows={dialogProps.synthesize.rows}
        defaultSelectedIds={dialogProps.synthesize.defaultSelectedIds}
        folder={dialogProps.synthesize.folder}
      />
      <ProcessPipelineDialog
        isOpen={dialogProps.process.isOpen}
        onClose={dialogProps.process.onClose}
        rows={dialogProps.process.rows}
        defaultSelectedIds={dialogProps.process.defaultSelectedIds}
        folder={dialogProps.process.folder}
      />
      {children}
    </LocalFileSubtitleContext.Provider>
  )
}
