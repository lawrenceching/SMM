import { useCallback } from "react";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository";
import { useMediaMetadataStoreActions, useMediaMetadataStoreState } from "@/stores/mediaMetadataStore";
import { hasDomainMetadataChanged } from "@/lib/uiDomainMapper";
import { nextTraceId } from "@/lib/utils";

/**
 * MediaMetadataActions handles business logic operations that may involve
 * both UI state updates and data persistence.
 */
export function useMediaMetadataActions() {
  const storeActions = useMediaMetadataStoreActions();
  const storeState = useMediaMetadataStoreState();

  const saveMediaMetadata = useCallback(async (
    metadata: UIMediaMetadata,
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `saveMediaMetadata-${nextTraceId()}`;

    try {
      await mediaMetadataRepository.write(metadata, { traceId });
      storeActions.addMediaMetadata(metadata);
      console.log(`[saveMediaMetadata][${traceId}] Media metadata saved successfully`);
    } catch (error) {
      console.error(`[saveMediaMetadata][${traceId}] Failed to save media metadata:`, error);
      throw error;
    }
  }, [storeActions]);

  const updateMediaMetadata = useCallback(async (
    path: string,
    updaterOrMetadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata),
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `updateMediaMetadata-${nextTraceId()}`;
    const currentMetadata = storeActions.getMediaMetadata(path);

    if (!currentMetadata) {
      console.error(`[updateMediaMetadata][${traceId}] No existing metadata found for path: ${path}`);
      return;
    }

    // Determine the metadata to update
    const metadataToUpdate = typeof updaterOrMetadata === 'function'
      ? updaterOrMetadata(currentMetadata)
      : updaterOrMetadata;

    // Ensure metadata.mediaFolderPath is set
    const finalMetadata = {
      ...metadataToUpdate,
      mediaFolderPath: metadataToUpdate.mediaFolderPath || path
    };

    // Check if domain metadata has changed (requires persistence)
    const domainChanged = hasDomainMetadataChanged(currentMetadata, finalMetadata);

    if (!domainChanged) {
      // Only UI properties changed, update UI state only
      console.log(`[updateMediaMetadata][${traceId}] Only UI properties updated, skipping persistence`);
      storeActions.updateMediaMetadata(path, () => finalMetadata);
      return;
    }

    // Domain metadata changed, persist and update UI
    console.log(`[updateMediaMetadata][${traceId}] Domain metadata changed, persisting`);
    try {
      await mediaMetadataRepository.write(finalMetadata, { traceId });
      storeActions.updateMediaMetadata(path, () => finalMetadata);
      console.log(`[updateMediaMetadata][${traceId}] Media metadata updated successfully`);
    } catch (error) {
      console.error(`[updateMediaMetadata][${traceId}] Failed to update media metadata:`, error);
      throw error;
    }
  }, [storeActions]);

  const deleteMediaMetadata = useCallback(async (
    path: string,
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `deleteMediaMetadata-${nextTraceId()}`;

    try {
      await mediaMetadataRepository.delete(path, options || {});
      storeActions.removeMediaMetadata(path);
      console.log(`[deleteMediaMetadata][${traceId}] Media metadata deleted successfully`);
    } catch (error) {
      console.error(`[deleteMediaMetadata][${traceId}] Failed to delete media metadata:`, error);
      throw error;
    }
  }, [storeActions]);

  const refreshMediaMetadata = useCallback(async (
    path: string,
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `refreshMediaMetadata-${nextTraceId()}`;
    const currentMetadata = storeActions.getMediaMetadata(path);

    try {
      const refreshed = await mediaMetadataRepository.refresh(path, currentMetadata, { traceId });
      storeActions.addMediaMetadata(refreshed);
      console.log(`[refreshMediaMetadata][${traceId}] Media metadata refreshed successfully`);
    } catch (error) {
      console.error(`[refreshMediaMetadata][${traceId}] Failed to refresh media metadata:`, error);
      throw error;
    }
  }, [storeActions]);

  const reloadAllMediaMetadata = useCallback(async (
    folderPaths: string[],
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `reloadAllMediaMetadata-${nextTraceId()}`;

    try {
      const currentMetadataMap = new Map(
        storeState.mediaMetadatas.map(m => [m.mediaFolderPath!, m])
      );

      const reloaded = await mediaMetadataRepository.reloadAll(folderPaths, currentMetadataMap, { traceId });

      // Update all metadata in store
      reloaded.forEach(metadata => {
        storeActions.addMediaMetadata(metadata);
      });

      console.log(`[reloadAllMediaMetadata][${traceId}] All media metadata reloaded successfully`);
    } catch (error) {
      console.error(`[reloadAllMediaMetadata][${traceId}] Failed to reload all media metadata:`, error);
      throw error;
    }
  }, [storeActions, storeState.mediaMetadatas]);

  const initializeMediaMetadata = useCallback(async (
    folderPathInPlatformFormat: string,
    type: "music-folder" | "tvshow-folder" | "movie-folder",
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `initializeMediaMetadata-${nextTraceId()}`;

    try {
      const initialized = await mediaMetadataRepository.initialize(folderPathInPlatformFormat, type, { traceId });
      storeActions.addMediaMetadata(initialized);
      console.log(`[initializeMediaMetadata][${traceId}] Media metadata initialized successfully`);
      return initialized;
    } catch (error) {
      console.error(`[initializeMediaMetadata][${traceId}] Failed to initialize media metadata:`, error);
      throw error;
    }
  }, [storeActions]);

  const upsertMediaMetadata = useCallback(async (
    metadata: UIMediaMetadata,
    options?: { traceId?: string }
  ) => {
    const traceId = options?.traceId || `upsertMediaMetadata-${nextTraceId()}`;

    try {
      await mediaMetadataRepository.write(metadata, { traceId });
      storeActions.addMediaMetadata(metadata);
      console.log(`[upsertMediaMetadata][${traceId}] Media metadata upserted successfully`);
    } catch (error) {
      console.error(`[upsertMediaMetadata][${traceId}] Failed to upsert media metadata:`, error);
      throw error;
    }
  }, [storeActions]);

  return {
    saveMediaMetadata,
    updateMediaMetadata,
    deleteMediaMetadata,
    refreshMediaMetadata,
    reloadAllMediaMetadata,
    initializeMediaMetadata,
    upsertMediaMetadata,
  };
}