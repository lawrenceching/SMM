import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai';
import { config } from 'dotenv';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  isFolderExistTool,
  createGetSelectedMediaMetadataTool,
  getMediaFoldersTool,
  listFilesInMediaFolderTool,
  matchEpisodeTool,
  createMatchEpisodesInBatchTool,
  createRenameFilesInBatchTool,
  createRenameFolderTool,
  createAskForConfirmationTool,
  getApplicationContextTool,
  createBeginRenameFilesTaskTool,
  createAddRenameFileToTaskTool,
  createEndRenameFilesTaskTool,
} from '../src/tools';
import { frontendTools } from '@assistant-ui/react-ai-sdk';
import { createGetMediaMetadataTool } from '@/tools/getMediaMetadata';

config();

interface ChatRequest {
  messages?: UIMessage[];
  model?: string;
  tools?: any;
  system?: string;
  clientId: string;
}

const openai = createOpenAICompatible({
  name: 'DeepSeek',
  baseURL: process.env.OPENAI_BASE_URL || '',
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    // Check if request is already aborted
    if (request.signal?.aborted) {
      console.log('Request was already aborted');
      return new Response(
        JSON.stringify({ error: 'Request was aborted' }),
        { status: 499, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract abort signal from request
    const abortSignal = request.signal;

    // Listen for abort event
    abortSignal?.addEventListener('abort', () => {
      console.log('Request was aborted by client');
      // All tools will be notified via their abortSignal parameter
    });

    const body = await request.json() as ChatRequest;
    const { messages, model, tools, system, clientId } = body;

    console.log('clientId:', clientId);
    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(messages || []);

    console.log(`baseURL: ${process.env.OPENAI_BASE_URL}, model: ${model || process.env.OPENAI_MODEL}`);
    const result = await streamText({
      model: openai.chatModel(model || process.env.OPENAI_MODEL || 'deepseek-chat'),
      messages: modelMessages,
      system: system,
      abortSignal: abortSignal,
      tools: {
        ...frontendTools(tools),
        getApplicationContext: getApplicationContextTool(clientId, abortSignal),
        isFolderExist: { ...isFolderExistTool, execute: (args: any) => isFolderExistTool.execute(args, abortSignal) },
        // getSelectedMediaMetadata: createGetSelectedMediaMetadataTool(clientId, abortSignal),
        getMediaMetadata: createGetMediaMetadataTool(clientId, abortSignal),
        getMediaFolders: { ...getMediaFoldersTool, execute: (args: any) => getMediaFoldersTool.execute(args, abortSignal) },
        listFilesInMediaFolder: { ...listFilesInMediaFolderTool, execute: (args: any) => listFilesInMediaFolderTool.execute(args, abortSignal) },
        // matchEpisode: { ...matchEpisodeTool, execute: (args: any) => matchEpisodeTool.execute(args, abortSignal) },
        matchEpisodesInBatch: createMatchEpisodesInBatchTool(clientId, abortSignal),
        // renameFilesInBatch: createRenameFilesInBatchTool(clientId, abortSignal),
        renameFolder: createRenameFolderTool(clientId, abortSignal),
        // askForConfirmation: createAskForConfirmationTool(clientId, abortSignal),
        beginRenameFilesTask: createBeginRenameFilesTaskTool(clientId, abortSignal),
        addRenameFileToTask: createAddRenameFileToTaskTool(clientId, abortSignal),
        endRenameFilesTask: createEndRenameFilesTaskTool(clientId, abortSignal),
      },
      stopWhen: stepCountIs(20)
    });

    // Check again before creating response
    if (abortSignal?.aborted) {
      console.log('Request aborted before response creation');
      throw new Error('Request aborted');
    }

    // Use toUIMessageStreamResponse for useChat compatibility
    const response = result.toUIMessageStreamResponse();
    console.log('Streaming response created');
    return response;
  } catch (error) {
    // Check if error is due to abort
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request aborted')) {
      console.log('Request was aborted during processing');
      return new Response(
        JSON.stringify({ error: 'Request was aborted' }),
        { status: 499, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

