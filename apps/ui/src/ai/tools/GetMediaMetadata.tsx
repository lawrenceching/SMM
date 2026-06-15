import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  GET_MEDIA_METADATA,
  GET_MEDIA_METADATA_DESCRIPTION,
  GET_MEDIA_METADATA_NOT_MANAGED,
  GET_MEDIA_METADATA_NO_CACHE,
  getMediaMetadataInputSchema,
  type GetMediaMetadataToolOutput,
} from '@core/types/ai-tools/getMediaMetadata'
import {
  createBaseGetMediaMetadataData,
  fillMediaMetadataResponseData,
} from '@core/ai-tool/getMediaMetadataResponse'
import { toolOk } from '@core/ai-tool/toolResult'
import { Path } from '@core/path'
import { useUIMediaFolderStoreState } from '@/stores/uiMediaFolderStore'
import { useQueryClient } from '@tanstack/react-query'
import {
  resolveMediaMetadataForFolderPath,
  isMediaFolderManagedInUi,
  useMediaMetadataToolBridge,
} from '@/ai/mediaMetadataToolBridge'

export { resolveMediaMetadataForFolderPath } from '@/ai/mediaMetadataToolBridge'

const getMediaMetadata = tool({
  description: GET_MEDIA_METADATA_DESCRIPTION,
  parameters: getMediaMetadataInputSchema,
  execute: async ({
    mediaFolderPath,
  }): Promise<GetMediaMetadataToolOutput> => {
    const baseData = createBaseGetMediaMetadataData(mediaFolderPath)
    if (!isMediaFolderManagedInUi(mediaFolderPath)) {
      return {
        ...baseData,
        error: GET_MEDIA_METADATA_NOT_MANAGED,
      }
    }

    const mediaMetadata =
      await resolveMediaMetadataForFolderPath(mediaFolderPath)
    if (!mediaMetadata) {
      return {
        ...baseData,
        error: GET_MEDIA_METADATA_NO_CACHE,
      }
    }

    const data = fillMediaMetadataResponseData(
      mediaMetadata,
      Path.posix(mediaFolderPath),
    )
    return toolOk(data)
  },
})

const _GetMediaMetadataTool = makeAssistantTool({
  ...getMediaMetadata,
  toolName: GET_MEDIA_METADATA,
})

export function GetMediaMetadataTool() {
  const { folders } = useUIMediaFolderStoreState()
  const queryClient = useQueryClient()
  useMediaMetadataToolBridge(folders, queryClient)

  return <_GetMediaMetadataTool />
}
