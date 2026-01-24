import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai';
import { config } from 'dotenv';
import {
  isFolderExistTool,
  getMediaFoldersTool,
  listFilesInMediaFolderTool,
  createMatchEpisodesInBatchTool,
  createRenameFolderTool,
  getApplicationContextTool,
  createBeginRenameFilesTaskTool,
  createAddRenameFileToTaskTool,
  createEndRenameFilesTaskTool,
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
  createGetEpisodesTool,
} from '../src/tools';
import { frontendTools } from '@assistant-ui/react-ai-sdk';
import { createGetMediaMetadataTool } from '@/tools/getMediaMetadata';
import { logger } from '../lib/logger';
import { getUserConfig } from '@/utils/config';
import { createAIProvider } from '../lib/ai-provider';
import type { Hono } from 'hono';

config();

interface ChatRequest {
  messages?: UIMessage[];
  model?: string;
  tools?: any;
  system?: string;
  clientId: string;
}

export async function processChatRequest(request: Request): Promise<Response> {

  const userConfig = await getUserConfig();
  if(userConfig.selectedAI === undefined) {
    return new Response(
      JSON.stringify({ error: 'No AI selected' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let aiProvider;
  let defaultModel;
  try {
    const { provider, model } = createAIProvider(userConfig);
    aiProvider = provider;
    defaultModel = model;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error 
    }, 'Failed to create AI provider');
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create AI provider' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check if request is already aborted
    if (request.signal?.aborted) {
      logger.info('Request was already aborted');
      return new Response(
        JSON.stringify({ error: 'Request was aborted' }),
        { status: 499, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract abort signal from request
    const abortSignal = request.signal;

    // Listen for abort event
    abortSignal?.addEventListener('abort', () => {
      logger.info('Request was aborted by client');
      // All tools will be notified via their abortSignal parameter
    });

    const body = await request.json() as ChatRequest;
    const { messages, model, tools, system, clientId } = body;


    logger.debug({
      body,
    }, "Received chat request with body")

    logger.debug({ clientId }, 'Processing chat request');
    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(messages || []);

    logger.debug({ selectedAI: userConfig.selectedAI, model: model || defaultModel }, 'Using AI model configuration');
    const result = streamText({
      model: aiProvider.chatModel(model || defaultModel),
      messages: modelMessages,
      system: system,
      abortSignal: abortSignal,
      tools: {
        ...frontendTools(tools),
        getApplicationContext: getApplicationContextTool(clientId, abortSignal),
        isFolderExist: { ...isFolderExistTool, execute: (args: any) => isFolderExistTool.execute(args, abortSignal) },
        // getSelectedMediaMetadata: createGetSelectedMediaMetadataTool(clientId, abortSignal),
        getMediaMetadata: createGetMediaMetadataTool(clientId, abortSignal),
        getEpisodes: createGetEpisodesTool(clientId, abortSignal),
        getMediaFolders: { ...getMediaFoldersTool, execute: (args: any) => getMediaFoldersTool.execute(args, abortSignal) },
        listFilesInMediaFolder: { ...listFilesInMediaFolderTool, execute: (args: any) => listFilesInMediaFolderTool.execute(args, abortSignal) },
        // matchEpisode: { ...matchEpisodeTool, execute: (args: any) => matchEpisodeTool.execute(args, abortSignal) },

        // deprecate the matchEpisodesInBatch
        // matchEpisodesInBatch: createMatchEpisodesInBatchTool(clientId, abortSignal),

        // renameFilesInBatch: createRenameFilesInBatchTool(clientId, abortSignal),
        renameFolder: createRenameFolderTool(clientId, abortSignal),
        // askForConfirmation: createAskForConfirmationTool(clientId, abortSignal),
        beginRenameFilesTask: createBeginRenameFilesTaskTool(clientId, abortSignal),
        addRenameFileToTask: createAddRenameFileToTaskTool(clientId, abortSignal),
        endRenameFilesTask: createEndRenameFilesTaskTool(clientId, abortSignal),
        beginRecognizeTask: createBeginRecognizeTaskTool(clientId, abortSignal),
        addRecognizedMediaFile: createAddRecognizedMediaFileTool(clientId, abortSignal),
        endRecognizeTask: createEndRecognizeTaskTool(clientId, abortSignal),
      },
      stopWhen: stepCountIs(100)
    });

    // Check again before creating response
    if (abortSignal?.aborted) {
      logger.info('Request aborted before response creation');
      throw new Error('Request aborted');
    }

    // Use toUIMessageStreamResponse for useChat compatibility
    const response = result.toUIMessageStreamResponse();
    logger.debug('Streaming response created');
    return response;
  } catch (error) {
    // Check if error is due to abort
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request aborted')) {
      logger.info('Request was aborted during processing');
      return new Response(
        JSON.stringify({ error: 'Request was aborted' }),
        { status: 499, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.error({ 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error 
    }, 'Chat API error');
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export function handleChatRequest(app: Hono) {
  app.post('/api/chat', async (c) => {
    try {
      // Use Hono's native request object
      const response = await processChatRequest(c.req.raw);
      return response;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error 
      }, 'Chat route error:');
      return c.json({ 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });
}

