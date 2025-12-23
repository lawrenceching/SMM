import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { getDeepseekProvider, DEEPSEEK_MODEL } from '../lib/ai-provider';
import { z } from 'zod';
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import os from 'os';

interface ChatRequest {
  messages?: UIMessage[];
  model?: string;
  tools?: any;
  system?: string;
}

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const body = await request.json() as ChatRequest;
    console.log(`>>> ${JSON.stringify(body)}`)
    const { messages, model, tools, system } = body;
    console.log('Received chat request:', { messageCount: messages?.length, model });

    // Convert UI messages to model messages format
    const modelMessages = convertToModelMessages(messages || []);
    console.log('Converted to model messages:', modelMessages.length);

    const deepseekProvider = getDeepseekProvider();
    const result = await streamText({
      model: deepseekProvider(model || DEEPSEEK_MODEL),
      messages: modelMessages,
      system: system,
      tools: {
        ...frontendTools(tools),
        os: {
          description: "Get the OS information",
          inputSchema: z.object(),
          execute: async ({  }) => {
            return {
              platform: os.platform(),
              arch: os.arch(),
              type: os.type(),
            };
          },
        },
      },
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

