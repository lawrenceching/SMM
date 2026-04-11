import { useMemo } from "react"
import { create } from "zustand"
import { useShallow } from "zustand/shallow"
import { Path } from "@core/path"
import type { UIMediaFolder, UIMediaFolderStatus } from "@/types/UIMediaFolder"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"

interface UIMediaFolderStoreState {
  folders: UIMediaFolder[]
  /** Primary selection (e.g. StatusBar, single-select sidebar). Empty string when none. */
  selectedFolder: string
  /** Multi-select set (e.g. Ctrl+click); paths in POSIX form for consistency. */
  selectedFolders: string[]
}

interface UIMediaFolderStoreActions {
  setFolders: (folders: UIMediaFolder[]) => void
  upsertFolder: (folder: UIMediaFolder) => void
  updateFolderStatus: (path: string, status: UIMediaFolderStatus) => void
  removeFolder: (path: string) => void
  setSelectedFolder: (path: string) => void
  setSelectedFolders: (paths: string[]) => void
  clearSelection: () => void
  applyFolderClick: (path: string, multi: boolean) => void
  selectAllFolderPaths: (paths: string[]) => void
}

type UIMediaFolderStore = UIMediaFolderStoreState & UIMediaFolderStoreActions

const useUIMediaFolderStore = create<UIMediaFolderStore>((set) => ({
  folders: [],
  selectedFolder: "",
  selectedFolders: [],

  setFolders: (folders) => set({ folders }),

  upsertFolder: (folder) =>
    set((state) => {
      const path = normalizeMediaFolderPathForQuery(folder.path)
      const normalized = { ...folder, path }
      const i = state.folders.findIndex((f) => f.path === path)
      if (i < 0) {
        return { folders: [...state.folders, normalized] }
      }
      const next = [...state.folders]
      next[i] = normalized
      return { folders: next }
    }),

  updateFolderStatus: (path, status) =>
    set((state) => {
      const p = normalizeMediaFolderPathForQuery(path)
      const i = state.folders.findIndex((f) => f.path === p)
      if (i < 0) return state
      const next = [...state.folders]
      next[i] = { ...next[i], status }
      return { folders: next }
    }),

  removeFolder: (path) =>
    set((state) => {
      const p = normalizeMediaFolderPathForQuery(path)
      return {
        folders: state.folders.filter((f) => f.path !== p),
        selectedFolder: state.selectedFolder === p ? "" : state.selectedFolder,
        selectedFolders: state.selectedFolders.filter((x) => x !== p),
      }
    }),

  setSelectedFolder: (path) =>
    set({
      selectedFolder: path ? normalizeMediaFolderPathForQuery(path) : "",
    }),

  setSelectedFolders: (paths) =>
    set({
      selectedFolders: paths.map((x) => normalizeMediaFolderPathForQuery(x)),
    }),

  clearSelection: () => set({ selectedFolder: "", selectedFolders: [] }),

  applyFolderClick: (rawPath, multi) =>
    set((state) => {
      const path = normalizeMediaFolderPathForQuery(rawPath)
      if (!multi) {
        return { selectedFolder: path, selectedFolders: [path] }
      }
      const next = new Set(state.selectedFolders)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return {
        selectedFolder: path,
        selectedFolders: [...next],
      }
    }),

  selectAllFolderPaths: (rawPaths) =>
    set(() => {
      const paths = [...new Set(rawPaths.map((p) => normalizeMediaFolderPathForQuery(p)))]
      return {
        selectedFolders: paths,
        selectedFolder: paths[0] ?? "",
      }
    }),
}))

/** Pure helper for later integration: map `UserConfig.folders` to {@link UIMediaFolder} rows. */
export function uiMediaFoldersFromPaths(paths: string[]): UIMediaFolder[] {
  return paths.map((path) => ({
    path: Path.posix(path),
    status: "idle",
    test: false,
  }))
}

export const useUIMediaFolderStoreState = () =>
  useUIMediaFolderStore(
    useShallow((s) => ({
      folders: s.folders,
      selectedFolder: s.selectedFolder,
      selectedFolders: s.selectedFolders,
    })),
  )

export const useUIMediaFolderStoreActions = () =>
  useUIMediaFolderStore(
    useShallow((s) => ({
      setFolders: s.setFolders,
      upsertFolder: s.upsertFolder,
      updateFolderStatus: s.updateFolderStatus,
      removeFolder: s.removeFolder,
      setSelectedFolder: s.setSelectedFolder,
      setSelectedFolders: s.setSelectedFolders,
      clearSelection: s.clearSelection,
      applyFolderClick: s.applyFolderClick,
      selectAllFolderPaths: s.selectAllFolderPaths,
    })),
  )

export function useUIMediaFolderSelection() {
  const { selectedFolder, selectedFolders } = useUIMediaFolderStoreState()
  const selectedFolderPathsSet = useMemo(() => new Set(selectedFolders), [selectedFolders])
  return { selectedFolder, selectedFolders, selectedFolderPathsSet }
}

export { useUIMediaFolderStore }
