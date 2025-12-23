import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from 'ai';
import { getDeepseekProvider, DEEPSEEK_MODEL } from '../lib/ai-provider';
import { z } from 'zod';
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import os from 'os';
import { config } from 'dotenv';
import { executeHelloTask } from './HelloTask';
import { join } from 'path';

config();

interface ChatRequest {
  messages?: UIMessage[];
  model?: string;
  tools?: any;
  system?: string;
}

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const body = await request.json() as ChatRequest;
    const { messages, model, tools, system } = body;

    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(messages || []);
    console.log('Converted to model messages:', modelMessages.length);

    const result = await streamText({
      model: openai.chat(model || process.env.OPENAI_MODEL || 'deepseek-chat'),
      messages: modelMessages,
      // system: system,
      tools: {
        ...frontendTools(tools),
        isFolderExist: {
          description: "Chekc if the folder exists in the file system",
          inputSchema: z.object({
            path: z.string().describe("The absolute path of the media folder in POSIX or Windows format"),
          }),
          execute: async ({ path }) => {
            return true;
          },
        },
        getMediaFolders: {
          description: "Get the media folders that managed by SMM",
          inputSchema: z.object(),
          execute: async ({  }) => {
            const {userDataDir} = await executeHelloTask()
            const obj = await Bun.file(join(userDataDir, 'smm.json')).json()
            const folders = obj.folders
            return folders
          },
        },
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

