import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Server } from './server';

// Create a custom provider with your baseURL and API key
const customProvider = createOpenAICompatible({
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com/v1', // Your custom base URL
  apiKey: '', // Your API key
});

// Create and start the server
const server = new Server({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  root: './public',
});

server.start();

// AI code
// const { text } = await generateText({
//   model: customProvider('deepseek-chat'), // Use the custom provider
//   prompt: 'Hello',
// });
// 
// console.log(text);