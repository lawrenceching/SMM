import { streamText, convertToModelMessages } from 'ai';
import { getDeepseekProvider, DEEPSEEK_MODEL } from '../lib/ai-provider';

export async function handleChatRequest(request: Request): Promise<Response> {
  try {
    const { messages, model } = await request.json();
    console.log('Received chat request:', { messageCount: messages?.length, model });

    // Convert UI messages to model messages format
    const modelMessages = convertToModelMessages(messages || []);
    console.log('Converted to model messages:', modelMessages.length);

    const deepseekProvider = getDeepseekProvider();
    const result = await streamText({
      model: deepseekProvider(model || DEEPSEEK_MODEL),
      messages: modelMessages,
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

