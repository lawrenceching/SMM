import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai';
import { config } from 'dotenv';
import { GET_APPLICATION_CONTEXT } from '@core/types/ai-tools/getApplicationContext';
import {
  BEGIN_RENAME_FILES_TASK,
  ADD_RENAME_FILE_TO_TASK,
  END_RENAME_FILES_TASK,
} from '@core/types/ai-tools/renameFilesTask';
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
} from '@core/types/ai-tools/recognizeMediaFileTask';
import { RENAME_FOLDER } from '@core/types/ai-tools/renameFolder';
import { IS_FOLDER_EXIST } from '@core/types/ai-tools/isFolderExist';
import { GET_MEDIA_METADATA } from '@core/types/ai-tools/getMediaMetadata';
import { GET_EPISODES } from '@core/types/ai-tools/getEpisodes';
import { GET_MEDIA_FOLDERS } from '@core/types/ai-tools/getMediaFolders';
import { LIST_FILES_IN_MEDIA_FOLDER } from '@core/types/ai-tools/listFilesInMediaFolder';
import {
  createBeginRenameFilesTaskTool,
  createAddRenameFileToTaskTool,
  createEndRenameFilesTaskTool,
} from '../src/tools/renameFilesTaskV2';
import {
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
} from '../src/tools';
import { getEpisodesAgentTool } from '../src/tools/getEpisodes';
import { agentTools } from '../src/tools';
import { frontendTools } from '@assistant-ui/react-ai-sdk';
import { logger } from '../lib/logger';
import { getUserConfig } from '@/utils/config';
import { createAIProvider } from '../lib/ai-provider';
import { SYSTEM_PROMPT } from '@core/ai-tool/systemPrompt';
import type { Hono } from 'hono';

config();

interface ChatRequest {
  messages?: UIMessage[]
  model?: string
  tools?: any
  system?: string
  clientId: string
}

export async function processChatRequest(request: Request): Promise<Response> {

  const userConfig = await getUserConfig()
  if(!userConfig.selectedAIProvider) {
    return new Response(
      JSON.stringify({ error: 'No AI selected' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let aiProvider
  let defaultModel
  try {
    const { provider, model } = createAIProvider(userConfig)
    aiProvider = provider
    defaultModel = model
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error 
    }, 'Failed to create AI provider')
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create AI provider' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    if (request.signal?.aborted) {
      logger.info('Request was already aborted')
      return new Response(
        JSON.stringify({ error: 'Request was aborted' }),
        { status: 499, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const abortSignal = request.signal

    abortSignal?.addEventListener('abort', () => {
      logger.info('Request was aborted by client')
    })

    const body = await request.json() as ChatRequest
    const { messages, model, tools, system, clientId } = body

    logger.debug({ body }, "Received chat request with body")
    logger.debug({ clientId }, 'Processing chat request')

    const modelMessages = await convertToModelMessages(messages || [])

    logger.debug({ selectedAIProvider: userConfig.selectedAIProvider, model: model || defaultModel }, 'Using AI model configuration')

    const result = streamText({
      model: aiProvider.chatModel(model || defaultModel),
      messages: modelMessages,
      // Fall back to the shared core system prompt if the client
      // did not include one. The frontend `AssistantChatTransport`
      // always sends it via the `ModelContext` registration, but
      // edge cases (e.g. programmatic clients, missing ModelContext)
      // should still produce sensible LLM behavior.
      system: system || SYSTEM_PROMPT,
      abortSignal: abortSignal,
      tools: {
        ...frontendTools(tools),
        [GET_APPLICATION_CONTEXT]: agentTools.getApplicationContext(clientId),
        [IS_FOLDER_EXIST]: agentTools.isFolderExist(clientId),
        [GET_MEDIA_METADATA]: agentTools.getMediaMetadata(clientId, abortSignal),
        [GET_EPISODES]: getEpisodesAgentTool(clientId, abortSignal),
        [GET_MEDIA_FOLDERS]: agentTools.getMediaFolders(clientId),
        [LIST_FILES_IN_MEDIA_FOLDER]: agentTools.listFiles(clientId),
        [RENAME_FOLDER]: agentTools.renameFolder(clientId, abortSignal),
        [BEGIN_RENAME_FILES_TASK]: createBeginRenameFilesTaskTool(clientId, abortSignal),
        [ADD_RENAME_FILE_TO_TASK]: createAddRenameFileToTaskTool(clientId, abortSignal),
        [END_RENAME_FILES_TASK]: createEndRenameFilesTaskTool(clientId, abortSignal),
        [BEGIN_RECOGNIZE_TASK]: createBeginRecognizeTaskTool(clientId, abortSignal),
        [ADD_RECOGNIZED_MEDIA_FILE]: createAddRecognizedMediaFileTool(clientId, abortSignal),
        [END_RECOGNIZE_TASK]: createEndRecognizeTaskTool(clientId, abortSignal),
      },
      stopWhen: stepCountIs(100)
    })

    if (abortSignal?.aborted) {
      logger.info('Request aborted before response creation')
      throw new Error('Request aborted')
    }

    const response = result.toUIMessageStreamResponse()
    logger.debug('Streaming response created')
    return response
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request aborted')) {
      logger.info('Request was aborted during processing')
      return new Response(
        JSON.stringify({ error: 'Request was aborted' }),
        { status: 499, headers: { 'Content-Type': 'application/json' } }
      )
    }

    logger.error({ 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error 
    }, 'Chat API error')
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export function handleChatRequest(app: Hono) {
  app.post('/api/chat', async (c) => {
    try {
      const response = await processChatRequest(c.req.raw)
      return response
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error 
      }, 'Chat route error:')
      return c.json({ 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  })
}
