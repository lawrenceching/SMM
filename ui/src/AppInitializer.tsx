import { useMount } from "react-use"
import localStorages from "./lib/localStorages";
import { useMediaMetadata } from "./components/media-metadata-provider";

/**
 * This component is used to initialize the app
 * 
 */
export function AppInitializer() {
    const { setSelectedMediaMetadata } = useMediaMetadata()

    useMount(() => {
        const selectedFolderIndex = localStorages.selectedFolderIndex ?? 0;
        console.log(`[AppInitializer] initialize app with selected folder index: ${selectedFolderIndex}`)
        setSelectedMediaMetadata(selectedFolderIndex)
    })

    return (
        <>
        </>
    )
}