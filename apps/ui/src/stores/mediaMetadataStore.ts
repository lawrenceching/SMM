import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import localStorages from "@/lib/localStorages";

interface MediaMetadataStoreState {
  mediaMetadatas: UIMediaMetadata[];
  selectedIndex: number;
}

interface MediaMetadataStoreActions {
  setMediaMetadatas: (metadatas: UIMediaMetadata[]) => void;
  addMediaMetadata: (metadata: UIMediaMetadata) => void;
  addMediaMetadatas: (metadatas: UIMediaMetadata[]) => void;
  updateMediaMetadata: (path: string, updater: (current: UIMediaMetadata) => UIMediaMetadata) => void;
  removeMediaMetadata: (path: string) => void;
  removeMediaMetadatas: (paths: string[]) => void;
  getMediaMetadata: (path: string) => UIMediaMetadata | undefined;
  updateMediaMetadataStatus: (folderPath: string, status: UIMediaMetadata['status']) => void;

  // Selection management
  setSelectedIndex: (index: number) => void;
  setSelectedByMediaFolderPath: (path: string) => void;
}

type MediaMetadataStore = MediaMetadataStoreState & MediaMetadataStoreActions;

const useMediaMetadataStore = create<MediaMetadataStore>((set, get) => ({
  mediaMetadatas: [],
  selectedIndex: localStorages.selectedFolderIndex ?? 0,

  setMediaMetadatas: (metadatas) => set({ mediaMetadatas: metadatas }),

  addMediaMetadata: (metadata) =>
    set((state) => {
      const existingIndex = state.mediaMetadatas.findIndex(
        (m) => m.mediaFolderPath === metadata.mediaFolderPath
      );

      if (existingIndex >= 0) {
        // Update existing
        const updated = [...state.mediaMetadatas];
        updated[existingIndex] = metadata;
        return { mediaMetadatas: updated };
      } else {
        // Add new
        return { mediaMetadatas: [...state.mediaMetadatas, metadata] };
      }
    }),

  addMediaMetadatas: (metadatas) =>
    set((state) => {
      if (metadatas.length === 0) return state;

      const metadataByPath = new Map(
        state.mediaMetadatas
          .filter((m) => m.mediaFolderPath)
          .map((m) => [m.mediaFolderPath!, m])
      );

      for (const metadata of metadatas) {
        if (!metadata.mediaFolderPath) continue;
        metadataByPath.set(metadata.mediaFolderPath, metadata);
      }

      return { mediaMetadatas: Array.from(metadataByPath.values()) };
    }),

  updateMediaMetadata: (path, updater) =>
    set((state) => {
      const index = state.mediaMetadatas.findIndex((m) => m.mediaFolderPath === path);
      if (index < 0) return state;

      const updated = [...state.mediaMetadatas];
      updated[index] = updater(updated[index]);
      return { mediaMetadatas: updated };
    }),

  removeMediaMetadata: (path) =>
    set((state) => ({
      mediaMetadatas: state.mediaMetadatas.filter((m) => m.mediaFolderPath !== path),
    })),

  removeMediaMetadatas: (paths) =>
    set((state) => {
      if (paths.length === 0) return state;
      const toRemove = new Set(paths);
      return {
        mediaMetadatas: state.mediaMetadatas.filter(
          (m) => m.mediaFolderPath && !toRemove.has(m.mediaFolderPath)
        ),
      };
    }),

  getMediaMetadata: (path) =>
    get().mediaMetadatas.find((m) => m.mediaFolderPath === path),

  updateMediaMetadataStatus: (folderPath, status) =>
    set((state) => {
      const index = state.mediaMetadatas.findIndex((m) => m.mediaFolderPath === folderPath);
      if (index < 0) return state;

      const updated = [...state.mediaMetadatas];
      updated[index] = { ...updated[index], status };
      return { mediaMetadatas: updated };
    }),

  setSelectedIndex: (index) => {
    set({ selectedIndex: index });
    localStorages.selectedFolderIndex = index;
  },

  setSelectedByMediaFolderPath: (path) => {
    const state = get();
    const index = state.mediaMetadatas.findIndex((m) => m.mediaFolderPath === path);
    if (index >= 0) {
      get().setSelectedIndex(index);
    }
  },
}));

// Selectors
export const useMediaMetadataStoreState = () =>
  useMediaMetadataStore(
    useShallow((state) => ({
      mediaMetadatas: state.mediaMetadatas,
      selectedIndex: state.selectedIndex,
      selectedMediaMetadata:
        state.selectedIndex >= 0 && state.selectedIndex < state.mediaMetadatas.length
          ? state.mediaMetadatas[state.selectedIndex]
          : undefined,
    }))
  );

// Actions
export const useMediaMetadataStoreActions = () =>
  useMediaMetadataStore(
    useShallow((state) => ({
      setMediaMetadatas: state.setMediaMetadatas,
      addMediaMetadata: state.addMediaMetadata,
      addMediaMetadatas: state.addMediaMetadatas,
      updateMediaMetadata: state.updateMediaMetadata,
      removeMediaMetadata: state.removeMediaMetadata,
      removeMediaMetadatas: state.removeMediaMetadatas,
      getMediaMetadata: state.getMediaMetadata,
      updateMediaMetadataStatus: state.updateMediaMetadataStatus,
      setSelectedIndex: state.setSelectedIndex,
      setSelectedByMediaFolderPath: state.setSelectedByMediaFolderPath,
    }))
  );

export { useMediaMetadataStore };