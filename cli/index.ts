import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Server } from './server';

interface CommandLineArguments {
  staticDir?: string;
  port?: number;
}

// Parse command line arguments
function parseArgs(): CommandLineArguments {
  const args = process.argv.slice(2);
  const result: CommandLineArguments = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--staticDir' && i + 1 < args.length) {
      const value = args[i + 1];
      if (value) {
        result.staticDir = value;
      }
      i++; // Skip the next argument as it's the value
    } else if (args[i] === '--port' && i + 1 < args.length) {
      const value = args[i + 1];
      if (value) {
        const port = parseInt(value, 10);
        if (!isNaN(port)) {
          result.port = port;
        }
      }
      i++; // Skip the next argument as it's the value
    }
  }

  console.log(`staticDir: ${result.staticDir}`);
  console.log(`port: ${result.port}`);
  
  return result;
}

// Create a custom provider with your baseURL and API key
const customProvider = createOpenAICompatible({
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com/v1', // Your custom base URL
  apiKey: '', // Your API key
});

// Parse command line arguments
const args = parseArgs();

// Create and start the server
const server = new Server({
  port: args.port ?? (process.env.PORT ? parseInt(process.env.PORT) : 30000),
  root: args.staticDir ?? './public',
});

server.start();

// AI code
// const { text } = await generateText({
//   model: customProvider('deepseek-chat'), // Use the custom provider
//   prompt: 'Hello',
// });
// 
// console.log(text);