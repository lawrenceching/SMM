import { type ReactNode, useEffect } from "react";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore";

interface MediaMetadataStoreProviderProps {
  children: ReactNode;
  initialMediaMetadatas?: UIMediaMetadata[];
}

export function MediaMetadataStoreProvider({
  children,
  initialMediaMetadatas = [],
}: MediaMetadataStoreProviderProps) {
  const { setMediaMetadatas } = useMediaMetadataStoreActions();

  // Sync store with initial data on mount / when initial list changes (including empty)
  useEffect(() => {
    setMediaMetadatas(initialMediaMetadatas);
  }, [initialMediaMetadatas, setMediaMetadatas]);

  return <>{children}</>;
}

// Re-export hooks for convenience
export { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore";