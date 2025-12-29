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
      tools: {
        ...frontendTools(tools),
        getApplicationContext: getApplicationContextTool(clientId),
        isFolderExist: isFolderExistTool,
        // getSelectedMediaMetadata: createGetSelectedMediaMetadataTool(clientId),
        getMediaMetadata: createGetMediaMetadataTool(clientId),
        getMediaFolders: getMediaFoldersTool,
        listFilesInMediaFolder: listFilesInMediaFolderTool,
        // matchEpisode: matchEpisodeTool,
        matchEpisodesInBatch: createMatchEpisodesInBatchTool(clientId),
        renameFilesInBatch: createRenameFilesInBatchTool(clientId),
        renameFolder: createRenameFolderTool(clientId),
        askForConfirmation: createAskForConfirmationTool(clientId),
      },
      stopWhen: stepCountIs(20)
    });

    // Use toUIMessageStreamResponse for useChat compatibility
    const response = result.toUIMessageStreamResponse();
    console.log('Streaming response created');
    return response;
  } catch (error) {
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

