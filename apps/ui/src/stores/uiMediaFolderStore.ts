import { useMemo } from "react"
import { create } from "zustand"
import { useShallow } from "zustand/shallow"
import type { UIMediaFolder, UIMediaFolderStatus } from "@/types/UIMediaFolder"
import { installUIMediaFolderStoreBridge } from "./uiMediaFolderStoreBridge"
import { queryClient } from "@/lib/queryClient"
import { PLANS_QUERY_ROOT } from "@/hooks/plans/plansQueryKeys"

interface UIMediaFolderStoreState {
  folders: UIMediaFolder[]
  /** Primary selection (e.g. StatusBar, single-select sidebar). Empty string when none. */
  selectedFolder: string
  /** Multi-select set (e.g. Ctrl+click); paths in platform-native form (same as {@link UIMediaFolder.path}). */
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

  setFolders: (folders) => { console.log(`[DIAG] uiMediaFolderStore.setFolders: ${folders.length} folders`); set({ folders }) },

  upsertFolder: (folder) =>
    set((state) => {
      const path = folder.path
      const i = state.folders.findIndex((f) => f.path === path)
      if (i < 0) {
        console.log(`[DIAG] uiMediaFolderStore.upsertFolder: insert path=${path} status=${folder.status} newCount=${state.folders.length + 1}`)
        return { folders: [...state.folders, { ...folder, path }] }
      }
      console.log(`[DIAG] uiMediaFolderStore.upsertFolder: update path=${path} status=${folder.status} currentCount=${state.folders.length}`)
      const next = [...state.folders]
      next[i] = { ...folder, path }
      return { folders: next }
    }),

  updateFolderStatus: (path, status) =>
    set((state) => {
      const p = path
      const i = state.folders.findIndex((f) => f.path === p)
      if (i < 0) return state
      const next = [...state.folders]
      next[i] = { ...next[i], status }
      return { folders: next }
    }),

  removeFolder: (path) =>
    set((state) => {
      const p = path
      return {
        folders: state.folders.filter((f) => f.path !== p),
        selectedFolder: state.selectedFolder === p ? "" : state.selectedFolder,
        selectedFolders: state.selectedFolders.filter((x) => x !== p),
      }
    }),

  setSelectedFolder: (path) =>
    set({
      selectedFolder: path ?? "",
      selectedFolders: path ? [path] : [],
    }),

  setSelectedFolders: (paths) =>
    set({
      selectedFolders: [...paths],
    }),

  clearSelection: () => set({ selectedFolder: "", selectedFolders: [] }),

  applyFolderClick: (rawPath, multi) =>
    set((state) => {
      const path = rawPath
      console.log(`[sidebar] folder click path=${path} multi=${multi}`)
      // Browser-side pulling: folder select refetches pending plans
      // (e.g. AI plans created while the browser was backgrounded).
      void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
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
      const paths = [...new Set(rawPaths)]
      return {
        selectedFolders: paths,
        selectedFolder: paths[0] ?? "",
      }
    }),
}))

installUIMediaFolderStoreBridge(() => {
  const { folders, selectedFolder } = useUIMediaFolderStore.getState()
  return { folders, selectedFolder }
})

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
