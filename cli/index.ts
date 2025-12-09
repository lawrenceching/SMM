import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// Create a custom provider with your baseURL and API key
const customProvider = createOpenAICompatible({
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com/v1', // Your custom base URL
  apiKey: '', // Your API key
});

const { text } = await generateText({
  model: customProvider('deepseek-chat'), // Use the custom provider
  prompt: 'Hello',
});

console.log(text);