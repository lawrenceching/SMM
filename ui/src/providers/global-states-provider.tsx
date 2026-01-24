import { createContext, useContext, useState, type ReactNode } from "react"

export interface MediaFolderState {
  loading: boolean
}

interface GlobalStatesContextValue {
  mediaFolderStates: Record<string, MediaFolderState>
  setMediaFolderStates: React.Dispatch<React.SetStateAction<Record<string, MediaFolderState>>>
}

const GlobalStatesContext = createContext<GlobalStatesContextValue | undefined>(undefined)

interface GlobalStatesProviderProps {
  children: ReactNode
}

export function GlobalStatesProvider({ children }: GlobalStatesProviderProps) {
  const [mediaFolderStates, setMediaFolderStates] = useState<Record<string, MediaFolderState>>({})

  const value: GlobalStatesContextValue = {
    mediaFolderStates,
    setMediaFolderStates,
  }

  return (
    <GlobalStatesContext.Provider value={value}>
      {children}
    </GlobalStatesContext.Provider>
  )
}

export function useGlobalStates(): GlobalStatesContextValue {
  const context = useContext(GlobalStatesContext)
  if (context === undefined) {
    throw new Error("useGlobalStates must be used within a GlobalStatesProvider")
  }
  return context
}
